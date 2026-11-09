import { randomInt } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockMovementType,
} from '@/common/graphql/prisma-enums';
import { PaginationArgs } from '@/common/pagination';
import { CartStatus, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { AddressService } from '../address/address.service';
import {
  consumeCoupon,
  evaluateCoupon,
  releaseCoupon,
} from '../coupon/coupon-pricing';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notification/notification.service';
import { CheckoutInput } from './dto/checkout.input';
import { CreateOrderInput, OrderItemInput } from './dto/create-order.input';
import { OrderFilterInput } from './dto/order-filter.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import {
  normalizePhone,
  shippingFeeFor,
  variantImage,
  variantName,
  variantSnapshotInclude,
} from './order-pricing';

type OrderDraft = Omit<CreateOrderInput, 'items'> & {
  items: OrderItemInput[];
  shippingProvinceCode?: string;
  shippingWardCode?: string;
};

const orderInclude = {
  items: true,
  payments: true,
  customer: {
    include: {
      addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
    },
  },
} satisfies Prisma.OrderInclude;

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly address: AddressService,
    private readonly notifications: NotificationService,
  ) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: OrderFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.OrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.contactPhone
        ? { contactPhone: { contains: filter.contactPhone } }
        : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const nodes = hasNextPage ? rows.slice(0, take) : rows;

    return {
      edges: nodes.map((node) => ({ cursor: node.id, node })),
      nodes,
      totalCount,
      hasNextPage,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw this.notFound();
    }

    return order;
  }

  async findByCode(orderCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: orderCode.toUpperCase() },
      include: orderInclude,
    });

    if (!order) {
      throw this.notFound();
    }

    return order;
  }

  /** Tạo đơn thủ công (admin). `shippingFee` bỏ trống thì tính theo quy tắc chung. */
  async create(input: CreateOrderInput) {
    const { order, notification } = await this.prisma.$transaction(
      async (tx) => {
        const order = await this.createInTx(tx, input);
        const notification = await this.notifications.createForOrderInTx(
          tx,
          order,
        );
        return { order, notification };
      },
    );
    await this.notifications.publish(notification);
    return order;
  }

  /**
   * Checkout giỏ hàng (khách vãng lai, COD). Giá, coupon, phí ship đều tính
   * lại ở server. Idempotent: gọi lại với cùng giỏ đã chốt trả về đơn cũ.
   */
  async checkout(input: CheckoutInput) {
    // Kiểm tra địa chỉ trước khi mở transaction (dữ liệu tĩnh, không cần khoá).
    const { province, ward } = await this.address.resolve(
      input.shippingProvinceCode,
      input.shippingWardCode,
    );

    // Chỉ thông báo khi thật sự tạo đơn mới (không phải lần gọi lặp lại idempotent).
    let notification: Awaited<
      ReturnType<NotificationService['createForOrderInTx']>
    > | null = null;

    const order = await this.prisma.$transaction(async (tx) => {
      // Khoá dòng giỏ để hai request checkout đồng thời không tạo hai đơn.
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE token = ${input.cartToken} FOR UPDATE`;

      const cart = await tx.cart.findUnique({
        where: { token: input.cartToken },
        include: { items: { orderBy: { addedAt: 'asc' } } },
      });

      if (!cart) {
        throw new AppException(
          'NOT_FOUND',
          I18N_KEYS.ERRORS.BUSINESS.CART.NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (cart.status === CartStatus.CONVERTED && cart.orderId) {
        return tx.order.findUniqueOrThrow({
          where: { id: cart.orderId },
          include: orderInclude,
        });
      }

      const order = await this.createInTx(tx, {
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        shippingName: input.shippingName,
        shippingPhone: input.shippingPhone,
        shippingAddress: input.shippingAddress,
        shippingWard: ward.name,
        shippingProvince: province.name,
        shippingProvinceCode: province.code,
        shippingWardCode: ward.code,
        note: input.note,
        couponCode: cart.couponCode ?? undefined,
        paymentMethod: PaymentMethod.COD,
        items: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: CartStatus.CONVERTED, orderId: order.id },
      });

      // Cùng transaction với đơn: đơn rollback thì thông báo cũng không có.
      notification = await this.notifications.createForOrderInTx(tx, order);
      return order;
    });

    // Sau commit mới đẩy realtime: admin không bao giờ thấy đơn chưa tồn tại.
    if (notification) {
      await this.notifications.publish(notification);
    }

    return order;
  }

  /** Tra cứu đơn công khai: cần đúng mã đơn và số điện thoại đặt hàng. */
  async lookup(orderCode: string, phone: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: orderCode.trim().toUpperCase() },
      include: orderInclude,
    });
    const wanted = normalizePhone(phone);

    if (
      !order ||
      wanted.length < 6 ||
      (normalizePhone(order.contactPhone) !== wanted &&
        normalizePhone(order.shippingPhone) !== wanted)
    ) {
      throw this.notFound();
    }

    return order;
  }

  private async createInTx(tx: Prisma.TransactionClient, input: OrderDraft) {
    if (input.items.length === 0) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.EMPTY_ITEMS,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Merge duplicated variant lines so stock is checked against the total.
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      quantities.set(
        item.variantId,
        (quantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }
    const variantIds = [...quantities.keys()];

    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: variantIds },
        deletedAt: null,
        isActive: true,
        product: { deletedAt: null },
      },
      include: variantSnapshotInclude,
    });

    if (variants.length !== variantIds.length) {
      const found = new Set(variants.map((variant) => variant.id));

      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.VARIANT_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
        { missing: variantIds.filter((id) => !found.has(id)) },
      );
    }

    let totalAmount = 0;
    const items = variants.map((variant) => {
      const quantity = quantities.get(variant.id)!;

      if (variant.stockQuantity < quantity) {
        throw this.insufficientStock(
          variant.id,
          variant.stockQuantity,
          quantity,
        );
      }

      const lineTotal = variant.price * quantity;
      totalAmount += lineTotal;

      return {
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variantName(variant),
        sku: variant.sku,
        image: variantImage(variant),
        quantity,
        unitPrice: variant.price,
        unitCost: variant.costPrice,
        lineTotal,
      };
    });

    if (input.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });

      if (!customer) {
        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
          { field: 'customerId', entity: 'Customer' },
        );
      }
    }

    let couponId: string | null = null;
    let couponCode: string | null = null;
    let discountAmount = 0;

    if (input.couponCode) {
      const evaluation = await evaluateCoupon(
        tx,
        input.couponCode,
        totalAmount,
      );

      await consumeCoupon(tx, evaluation.coupon);
      discountAmount = evaluation.discountAmount;
      couponId = evaluation.coupon.id;
      couponCode = evaluation.coupon.code;
    }

    const shippingFee =
      input.shippingFee ?? shippingFeeFor(totalAmount - discountAmount);
    const finalAmount = totalAmount - discountAmount + shippingFee;
    const orderCode = await this.nextOrderCode(tx);

    const order = await tx.order.create({
      data: {
        orderCode,
        customerId: input.customerId ?? null,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone.trim(),
        shippingName: input.shippingName.trim(),
        shippingPhone: input.shippingPhone.trim(),
        shippingAddress: input.shippingAddress.trim(),
        shippingWard: input.shippingWard.trim(),
        shippingDistrict: input.shippingDistrict?.trim() || null,
        shippingProvince: input.shippingProvince.trim(),
        shippingProvinceCode: input.shippingProvinceCode ?? null,
        shippingWardCode: input.shippingWardCode ?? null,
        note: input.note?.trim() || null,
        totalAmount,
        discountAmount,
        shippingFee,
        finalAmount,
        couponId,
        couponCode,
        paymentMethod: input.paymentMethod,
        items: { create: items },
      },
      include: orderInclude,
    });

    // Trừ kho sau khi có đơn để sổ kho gắn được orderId. Lỗi -> rollback cả đơn.
    for (const item of items) {
      await this.inventory.applyMovement(tx, {
        variantId: item.variantId,
        delta: -item.quantity,
        type: StockMovementType.ORDER,
        orderId: order.id,
      });
    }

    return order;
  }

  async updateStatus(input: UpdateOrderStatusInput) {
    const order = await this.findOne(input.id);

    if (order.status === input.status) {
      return order;
    }

    if (!TRANSITIONS[order.status].includes(input.status)) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.INVALID_STATUS_TRANSITION,
        HttpStatus.BAD_REQUEST,
        { from: order.status, to: input.status },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.OrderUpdateManyMutationInput = {
        status: input.status,
      };

      if (
        input.status === OrderStatus.COMPLETED &&
        order.paymentMethod === PaymentMethod.COD &&
        order.paymentStatus === PaymentStatus.UNPAID
      ) {
        data.paymentStatus = PaymentStatus.PAID;
      }

      // Chỉ chuyển nếu trạng thái chưa bị request khác đổi -> tránh hoàn kho 2 lần.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data,
      });

      if (count === 0) {
        throw new AppException(
          'CONFLICT',
          I18N_KEYS.ERRORS.BUSINESS.ORDER.STATUS_CHANGED,
          HttpStatus.CONFLICT,
        );
      }

      if (input.status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          if (item.variantId) {
            await this.inventory.applyMovement(tx, {
              variantId: item.variantId,
              delta: item.quantity,
              type: StockMovementType.ORDER_CANCEL,
              orderId: order.id,
              skipIfMissing: true,
            });
          }
        }

        if (order.couponId) {
          await releaseCoupon(tx, order.couponId);
        }
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });
  }

  private async nextOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `DH${stamp}${randomInt(100000, 1000000)}`;
      const exists = await tx.order.findUnique({
        where: { orderCode: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    throw new AppException(
      'INTERNAL_SERVER_ERROR',
      I18N_KEYS.ERRORS.SYSTEM.INTERNAL_SERVER_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private insufficientStock(
    variantId: string,
    available?: number,
    requested?: number,
  ): AppException {
    return new AppException(
      'CONFLICT',
      I18N_KEYS.ERRORS.BUSINESS.ORDER.INSUFFICIENT_STOCK,
      HttpStatus.CONFLICT,
      { variantId, available, requested },
    );
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.BUSINESS.ORDER.ORDER_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }
}
