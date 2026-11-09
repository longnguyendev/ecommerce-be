import { randomInt } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import {
  ReceiptStatus,
  StockMovementType,
} from '@/common/graphql/prisma-enums';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import {
  AdjustStockInput,
  InventoryFilterInput,
  PurchaseReceiptFilterInput,
  StockMovementFilterInput,
} from './dto/inventory-filters.input';
import {
  CreatePurchaseReceiptInput,
  PurchaseReceiptItemInput,
  UpdatePurchaseReceiptInput,
} from './dto/purchase-receipt.input';

type Tx = Prisma.TransactionClient;

export interface MovementInput {
  variantId: string;
  /** Có dấu: + nhập, - xuất. */
  delta: number;
  type: StockMovementType;
  reason?: string;
  unitCost?: number;
  receiptId?: string;
  orderId?: string;
  createdById?: string;
  /** Biến thể đã xoá/không còn: bỏ qua thay vì ném lỗi (vd. hoàn kho đơn cũ). */
  skipIfMissing?: boolean;
}

const variantView = {
  product: { select: { id: true, name: true } },
  attributes: { include: { attributeValue: true } },
} satisfies Prisma.ProductVariantInclude;

const receiptInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: { variant: { include: variantView } },
  },
} satisfies Prisma.PurchaseReceiptInclude;

type VariantWithView = Prisma.ProductVariantGetPayload<{
  include: typeof variantView;
}>;

function variantName(variant: VariantWithView): string | null {
  return variant.attributes.length > 0
    ? variant.attributes.map((a) => a.attributeValue.value).join(' / ')
    : null;
}

function connection<T>(rows: T[], take: number, totalCount: number) {
  const hasNextPage = rows.length > take;
  const nodes = hasNextPage ? rows.slice(0, take) : rows;
  return {
    edges: nodes.map((node, i) => ({ cursor: String(i), node })),
    nodes,
    totalCount,
    hasNextPage,
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────── Lõi: mọi thay đổi tồn kho đều đi qua đây ─────────

  /**
   * Đổi tồn của 1 biến thể + ghi StockMovement, phải gọi trong transaction.
   * Trừ kho dùng updateMany có điều kiện `stockQuantity >= số trừ` nên an toàn
   * khi nhiều đơn chạy đồng thời. Trả về null nếu `skipIfMissing` và biến thể
   * không còn.
   */
  async applyMovement(
    tx: Tx,
    input: MovementInput,
  ): Promise<{ balanceAfter: number } | null> {
    const { variantId, delta } = input;

    const updated = await tx.productVariant.updateMany({
      where: {
        id: variantId,
        deletedAt: null,
        ...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}),
      },
      data: {
        stockQuantity: delta < 0 ? { decrement: -delta } : { increment: delta },
      },
    });

    if (updated.count === 0) {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
        select: { stockQuantity: true },
      });

      if (!variant) {
        if (input.skipIfMissing) return null;
        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.BUSINESS.INVENTORY.VARIANT_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
          { variantId },
        );
      }

      throw new AppException(
        'CONFLICT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.INSUFFICIENT_STOCK,
        HttpStatus.CONFLICT,
        { variantId, available: variant.stockQuantity, requested: -delta },
      );
    }

    const { stockQuantity } = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stockQuantity: true },
    });

    await tx.stockMovement.create({
      data: {
        variantId,
        type: input.type,
        quantity: delta,
        balanceAfter: stockQuantity,
        unitCost: input.unitCost,
        reason: input.reason,
        receiptId: input.receiptId,
        orderId: input.orderId,
        createdById: input.createdById,
      },
    });

    return { balanceAfter: stockQuantity };
  }

  /** Điều chỉnh về đúng số tồn thực tế (kiểm kho). Không đổi thì không ghi sổ. */
  async adjustStock(input: AdjustStockInput, createdById?: string) {
    await this.prisma.$transaction(async (tx) => {
      // Khoá dòng biến thể để delta tính trên số tồn không đổi giữa chừng.
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${input.variantId} FOR UPDATE`;

      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, deletedAt: null },
        select: { stockQuantity: true },
      });
      if (!variant) {
        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.BUSINESS.INVENTORY.VARIANT_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
          { variantId: input.variantId },
        );
      }

      const delta = input.newQuantity - variant.stockQuantity;
      if (delta === 0) return;

      await this.applyMovement(tx, {
        variantId: input.variantId,
        delta,
        type: StockMovementType.ADJUSTMENT,
        reason: input.reason.trim(),
        createdById,
      });
    });

    return this.inventoryVariant(input.variantId);
  }

  // ───────── Phiếu nhập ─────────

  async createReceipt(input: CreatePurchaseReceiptInput, createdById?: string) {
    await this.assertVariants(input.items);

    const id = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          code: await this.nextReceiptCode(tx),
          note: input.note?.trim() || null,
          createdById,
          items: { create: this.itemData(input.items) },
        },
        select: { id: true },
      });
      return receipt.id;
    });

    return this.receipt(id);
  }

  async updateReceipt(input: UpdatePurchaseReceiptInput) {
    if (input.items) await this.assertVariants(input.items);

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.purchaseReceipt.updateMany({
        where: { id: input.id, status: ReceiptStatus.DRAFT },
        data: { note: input.note?.trim() || null },
      });
      if (changed.count === 0) await this.failReceipt(tx, input.id);

      if (input.items) {
        await tx.purchaseReceiptItem.deleteMany({
          where: { receiptId: input.id },
        });
        await tx.purchaseReceiptItem.createMany({
          data: this.itemData(input.items).map((i) => ({
            ...i,
            receiptId: input.id,
          })),
        });
      }
    });

    return this.receipt(input.id);
  }

  async cancelReceipt(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.purchaseReceipt.updateMany({
        where: { id, status: ReceiptStatus.DRAFT },
        data: { status: ReceiptStatus.CANCELLED },
      });
      if (changed.count === 0) await this.failReceipt(tx, id);
    });

    return this.receipt(id);
  }

  /**
   * Xác nhận phiếu: cộng tồn từng dòng (ghi sổ) và cập nhật giá vốn bình quân
   * gia quyền = (tồn cũ × giá vốn cũ + SL nhập × giá nhập) / (tồn cũ + SL nhập).
   */
  async confirmReceipt(id: string, createdById?: string) {
    await this.prisma.$transaction(async (tx) => {
      // Chuyển DRAFT -> CONFIRMED có điều kiện: chặn xác nhận 2 lần đồng thời.
      const changed = await tx.purchaseReceipt.updateMany({
        where: { id, status: ReceiptStatus.DRAFT },
        data: { status: ReceiptStatus.CONFIRMED, confirmedAt: new Date() },
      });
      if (changed.count === 0) await this.failReceipt(tx, id);

      const items = await tx.purchaseReceiptItem.findMany({
        where: { receiptId: id },
        orderBy: { id: 'asc' },
      });
      if (items.length === 0) {
        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_EMPTY,
          HttpStatus.BAD_REQUEST,
        );
      }

      for (const item of items) {
        const result = await this.applyMovement(tx, {
          variantId: item.variantId,
          delta: item.quantity,
          type: StockMovementType.RECEIPT,
          unitCost: item.unitCost,
          receiptId: id,
          createdById,
        });

        const before = result!.balanceAfter - item.quantity;
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { costPrice: true },
        });
        // Nhớ giá vốn trước khi nhập để hoàn lại được khi phiếu quay về nháp.
        await tx.purchaseReceiptItem.update({
          where: { id: item.id },
          data: { costBefore: variant.costPrice },
        });
        const costPrice = Math.round(
          (before * variant.costPrice + item.quantity * item.unitCost) /
            (before + item.quantity),
        );

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { costPrice },
        });
      }
    });

    return this.receipt(id);
  }

  /**
   * Hoàn phiếu đã nhập kho về nháp: trừ lại đúng số lượng đã cộng (ghi sổ
   * RECEIPT_REVERT) và gỡ lô này khỏi giá vốn bình quân. Chỉ làm được khi tồn
   * hiện tại của MỌI biến thể trong phiếu >= số lượng của phiếu (nếu đã bán bớt
   * thì không đủ hàng để trừ lại). Tất cả hoặc không gì cả.
   */
  async revertReceipt(id: string, createdById?: string) {
    await this.prisma.$transaction(async (tx) => {
      // Chuyển CONFIRMED -> DRAFT có điều kiện: chặn hoàn 2 lần đồng thời.
      const changed = await tx.purchaseReceipt.updateMany({
        where: { id, status: ReceiptStatus.CONFIRMED },
        data: { status: ReceiptStatus.DRAFT, confirmedAt: null },
      });
      if (changed.count === 0) {
        const row = await tx.purchaseReceipt.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!row) throw this.receiptNotFound(id);
        throw new AppException(
          'CONFLICT',
          I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_CONFIRMED,
          HttpStatus.CONFLICT,
          { id, status: row.status },
        );
      }

      const items = await tx.purchaseReceiptItem.findMany({
        where: { receiptId: id },
        orderBy: { id: 'asc' },
        include: { variant: { select: { sku: true } } },
      });

      // Kiểm tra trước để báo đủ danh sách biến thể thiếu hàng.
      const stocks = await tx.productVariant.findMany({
        where: { id: { in: items.map((i) => i.variantId) } },
        select: { id: true, stockQuantity: true, deletedAt: true },
      });
      const stockById = new Map(stocks.map((s) => [s.id, s]));
      const short = items
        .filter((i) => {
          const s = stockById.get(i.variantId);
          return !s || s.deletedAt !== null || s.stockQuantity < i.quantity;
        })
        .map((i) => ({
          variantId: i.variantId,
          sku: i.variant.sku,
          required: i.quantity,
          available: stockById.get(i.variantId)?.stockQuantity ?? 0,
        }));
      if (short.length > 0) {
        throw new AppException(
          'CONFLICT',
          I18N_KEYS.ERRORS.BUSINESS.INVENTORY.REVERT_INSUFFICIENT_STOCK,
          HttpStatus.CONFLICT,
          { id, short },
        );
      }

      for (const item of items) {
        // Trừ có điều kiện nguyên tử; phòng đơn hàng chen vào sau bước kiểm tra.
        const result = await this.applyMovement(tx, {
          variantId: item.variantId,
          delta: -item.quantity,
          type: StockMovementType.RECEIPT_REVERT,
          unitCost: item.unitCost,
          receiptId: id,
          reason: 'Hoàn phiếu nhập về nháp',
          createdById,
        });

        const remaining = result!.balanceAfter;
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { costPrice: true },
        });
        // Gỡ lô khỏi bình quân: (tồn × giá vốn − SL × giá nhập) / tồn còn lại.
        // Hết hàng thì quay về giá vốn trước khi nhập (nếu có ghi nhớ).
        const costPrice =
          remaining > 0
            ? Math.max(
                0,
                Math.round(
                  ((remaining + item.quantity) * variant.costPrice -
                    item.quantity * item.unitCost) /
                    remaining,
                ),
              )
            : (item.costBefore ?? variant.costPrice);

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { costPrice },
        });
      }
    });

    return this.receipt(id);
  }

  async receipts(
    pagination: PaginationArgs = {},
    filter: PurchaseReceiptFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const where: Prisma.PurchaseReceiptWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? { code: { contains: filter.search.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.purchaseReceipt.findMany({
        where,
        take: take + 1,
        skip: pagination.skip ?? 0,
        orderBy: { createdAt: 'desc' },
        include: receiptInclude,
      }),
      this.prisma.purchaseReceipt.count({ where }),
    ]);

    return connection(
      rows.map((r) => this.toReceiptView(r)),
      take,
      totalCount,
    );
  }

  async receipt(id: string) {
    const row = await this.prisma.purchaseReceipt.findUnique({
      where: { id },
      include: receiptInclude,
    });
    if (!row) throw this.receiptNotFound(id);
    return this.toReceiptView(row);
  }

  // ───────── Tồn kho + lịch sử ─────────

  async inventoryVariants(
    pagination: PaginationArgs = {},
    filter: InventoryFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const search = filter.search?.trim();
    const where: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      product: { deletedAt: null },
      ...(filter.lowStockThreshold !== undefined
        ? { stockQuantity: { lte: filter.lowStockThreshold } }
        : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              { product: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        take: take + 1,
        skip: pagination.skip ?? 0,
        orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
        include: variantView,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return connection(
      rows.map((v) => this.toInventoryVariant(v)),
      take,
      totalCount,
    );
  }

  async inventoryVariant(variantId: string) {
    const row = await this.prisma.productVariant.findFirstOrThrow({
      where: { id: variantId, deletedAt: null },
      include: variantView,
    });
    return this.toInventoryVariant(row);
  }

  async movements(
    pagination: PaginationArgs = {},
    filter: StockMovementFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const where: Prisma.StockMovementWhereInput = {
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        take: take + 1,
        skip: pagination.skip ?? 0,
        orderBy: { createdAt: 'desc' },
        include: { variant: { include: variantView } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return connection(
      rows.map(({ variant, ...m }) => ({
        ...m,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variantName(variant),
      })),
      take,
      totalCount,
    );
  }

  // ───────── Nội bộ ─────────

  private toInventoryVariant(v: VariantWithView) {
    return {
      variantId: v.id,
      productId: v.productId,
      productName: v.product.name,
      variantName: variantName(v),
      sku: v.sku,
      stockQuantity: v.stockQuantity,
      costPrice: v.costPrice,
      price: v.price,
      isActive: v.isActive,
    };
  }

  private toReceiptView(
    row: Prisma.PurchaseReceiptGetPayload<{ include: typeof receiptInclude }>,
  ) {
    const items = row.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      sku: i.variant.sku,
      productName: i.variant.product.name,
      variantName: variantName(i.variant),
      quantity: i.quantity,
      unitCost: i.unitCost,
    }));

    // Cùng quy tắc với revertReceipt: FE chỉ hiển thị kết quả này.
    const revertShortages =
      row.status === ReceiptStatus.CONFIRMED
        ? row.items
            .filter(
              (i) =>
                i.variant.deletedAt !== null ||
                i.variant.stockQuantity < i.quantity,
            )
            .map((i) => ({
              variantId: i.variantId,
              sku: i.variant.sku,
              productName: i.variant.product.name,
              variantName: variantName(i.variant),
              required: i.quantity,
              available: i.variant.stockQuantity,
            }))
        : [];

    return {
      id: row.id,
      code: row.code,
      canRevert:
        row.status === ReceiptStatus.CONFIRMED && revertShortages.length === 0,
      revertShortages,
      note: row.note,
      status: row.status,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      items,
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      totalCost: items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
    };
  }

  /** Gộp các dòng cùng biến thể (cộng SL, giá nhập bình quân theo SL). */
  private itemData(items: PurchaseReceiptItemInput[]) {
    const merged = new Map<string, { quantity: number; total: number }>();
    for (const i of items) {
      const cur = merged.get(i.variantId) ?? { quantity: 0, total: 0 };
      cur.quantity += i.quantity;
      cur.total += i.quantity * i.unitCost;
      merged.set(i.variantId, cur);
    }
    return [...merged].map(([variantId, m]) => ({
      variantId,
      quantity: m.quantity,
      unitCost: Math.round(m.total / m.quantity),
    }));
  }

  private async assertVariants(items: PurchaseReceiptItemInput[]) {
    const ids = [...new Set(items.map((i) => i.variantId))];
    const found = await this.prisma.productVariant.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const have = new Set(found.map((v) => v.id));
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.INVENTORY.VARIANT_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
        { missing: ids.filter((id) => !have.has(id)) },
      );
    }
  }

  /** Phân biệt "không tồn tại" và "không còn ở trạng thái nháp". */
  private async failReceipt(tx: Tx, id: string): Promise<never> {
    const row = await tx.purchaseReceipt.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!row) throw this.receiptNotFound(id);
    throw new AppException(
      'CONFLICT',
      I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_DRAFT,
      HttpStatus.CONFLICT,
      { id, status: row.status },
    );
  }

  private receiptNotFound(id: string): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { id },
    );
  }

  private async nextReceiptCode(tx: Tx): Promise<string> {
    const now = new Date();
    const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `PN${stamp}${randomInt(1000, 10000)}`;
      const exists = await tx.purchaseReceipt.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }

    throw new AppException(
      'INTERNAL_SERVER_ERROR',
      I18N_KEYS.ERRORS.SYSTEM.INTERNAL_SERVER_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
