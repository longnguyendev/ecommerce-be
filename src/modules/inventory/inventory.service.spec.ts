import type { ConfigService } from '@nestjs/config';

import { I18N_KEYS } from '@/common/constants';
import {
  OrderStatus,
  PaymentMethod,
  ReceiptStatus,
  StockMovementType,
} from '@/common/graphql/prisma-enums';
import { PrismaService } from '@/prisma/prisma.service';

import { OrderService } from '../order/order.service';
import { InventoryService } from './inventory.service';

/**
 * Integration test trên DB thật. Chỉ chạy khi có TEST_DATABASE_URL (một database
 * riêng đã `prisma migrate deploy`), tránh đụng dữ liệu dev:
 *   TEST_DATABASE_URL=postgresql://.../ecommerce-be-test NODE_OPTIONS=--experimental-vm-modules yarn test inventory
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run('InventoryService (DB)', () => {
  let prisma: PrismaService;
  let inventory: InventoryService;
  let orders: OrderService;
  let categoryId: string;
  let seq = 0;

  beforeAll(async () => {
    prisma = new PrismaService({
      get: () => url,
    } as unknown as ConfigService<never>);
    await prisma.onModuleInit();
    inventory = new InventoryService(prisma);
    orders = new OrderService(prisma, inventory);
    const category = await prisma.category.create({
      data: { name: 'Test', slug: `test-${Date.now()}` },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.purchaseReceipt.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.onModuleDestroy();
  });

  async function makeVariant(stock = 0, costPrice = 0) {
    seq += 1;
    const product = await prisma.product.create({
      data: { categoryId, name: `P${seq}`, slug: `p-${Date.now()}-${seq}` },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `SKU-${Date.now()}-${seq}`,
        price: 500_000,
        costPrice,
        stockQuantity: stock,
      },
    });
    return variant.id;
  }

  const stockOf = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } }))
      .stockQuantity;

  /** Invariant: balanceAfter của dòng mới nhất luôn bằng stockQuantity. */
  async function expectLedgerConsistent(id: string) {
    const last = await prisma.stockMovement.findFirst({
      where: { variantId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (last) expect(last.balanceAfter).toBe(await stockOf(id));
  }

  it('xác nhận phiếu: cộng tồn, ghi sổ, giá vốn bình quân gia quyền', async () => {
    const id = await makeVariant(10, 100);
    const receipt = await inventory.createReceipt({
      note: 'lô 1',
      items: [{ variantId: id, quantity: 10, unitCost: 200 }],
    });
    expect(receipt.status).toBe(ReceiptStatus.DRAFT);
    expect(receipt.totalCost).toBe(2000);

    const done = await inventory.confirmReceipt(receipt.id, 'admin-1');
    expect(done.status).toBe(ReceiptStatus.CONFIRMED);

    const v = await prisma.productVariant.findUniqueOrThrow({
      where: { id },
    });
    expect(v.stockQuantity).toBe(20);
    expect(v.costPrice).toBe(150); // (10×100 + 10×200) / 20

    const m = await prisma.stockMovement.findFirstOrThrow({
      where: { variantId: id, type: StockMovementType.RECEIPT },
    });
    expect(m).toMatchObject({
      quantity: 10,
      balanceAfter: 20,
      unitCost: 200,
      receiptId: receipt.id,
      createdById: 'admin-1',
    });
    await expectLedgerConsistent(id);
  });

  it('xác nhận phiếu hai lần: lần hai bị từ chối, tồn không đổi', async () => {
    const id = await makeVariant(0);
    const r = await inventory.createReceipt({
      items: [{ variantId: id, quantity: 5, unitCost: 100 }],
    });
    await inventory.confirmReceipt(r.id);
    await expect(inventory.confirmReceipt(r.id)).rejects.toMatchObject({
      i18nKey: I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_DRAFT,
    });
    expect(await stockOf(id)).toBe(5);
    expect(await prisma.stockMovement.count({ where: { variantId: id } })).toBe(
      1,
    );
  });

  it('phiếu đã huỷ không xác nhận được; phiếu nháp sửa được', async () => {
    const id = await makeVariant(0);
    const r = await inventory.createReceipt({
      items: [{ variantId: id, quantity: 1, unitCost: 1 }],
    });
    const edited = await inventory.updateReceipt({
      id: r.id,
      items: [
        { variantId: id, quantity: 2, unitCost: 100 },
        { variantId: id, quantity: 2, unitCost: 200 }, // gộp dòng trùng
      ],
    });
    expect(edited.items).toHaveLength(1);
    expect(edited.items[0]).toMatchObject({ quantity: 4, unitCost: 150 });

    await inventory.cancelReceipt(r.id);
    await expect(inventory.confirmReceipt(r.id)).rejects.toBeDefined();
    expect(await stockOf(id)).toBe(0);
  });

  it('hoàn phiếu về nháp: trừ lại tồn, gỡ lô khỏi giá vốn, ghi sổ, nhập lại được', async () => {
    const id = await makeVariant(10, 100);
    const r = await inventory.createReceipt({
      items: [{ variantId: id, quantity: 10, unitCost: 200 }],
    });
    await inventory.confirmReceipt(r.id);
    expect(await stockOf(id)).toBe(20);

    const back = await inventory.revertReceipt(r.id, 'admin-3');
    expect(back.status).toBe(ReceiptStatus.DRAFT);
    expect(back.confirmedAt).toBeNull();

    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
    expect(v.stockQuantity).toBe(10); // về đúng số ban đầu
    expect(v.costPrice).toBe(100); // gỡ lô: (20×150 − 10×200) / 10

    const rev = await prisma.stockMovement.findFirstOrThrow({
      where: { variantId: id, type: StockMovementType.RECEIPT_REVERT },
    });
    expect(rev).toMatchObject({
      quantity: -10,
      balanceAfter: 10,
      receiptId: r.id,
      createdById: 'admin-3',
    });
    await expectLedgerConsistent(id);

    // Phiếu nháp lại: sửa và nhập kho lại được.
    await inventory.confirmReceipt(r.id);
    expect(await stockOf(id)).toBe(20);
  });

  it('hoàn phiếu khi tồn hiện tại < số lượng phiếu: từ chối, không đổi gì', async () => {
    const id = await makeVariant(0, 0);
    const r = await inventory.createReceipt({
      items: [{ variantId: id, quantity: 5, unitCost: 100 }],
    });
    const confirmed = await inventory.confirmReceipt(r.id);
    expect(confirmed.canRevert).toBe(true);
    // Bán bớt 2 -> tồn 3 < 5
    await prisma.$transaction((tx) =>
      inventory.applyMovement(tx, {
        variantId: id,
        delta: -2,
        type: StockMovementType.ORDER,
      }),
    );

    await expect(inventory.revertReceipt(r.id)).rejects.toMatchObject({
      i18nKey: I18N_KEYS.ERRORS.BUSINESS.INVENTORY.REVERT_INSUFFICIENT_STOCK,
      params: {
        short: [expect.objectContaining({ required: 5, available: 3 })],
      },
    });
    expect(await stockOf(id)).toBe(3);
    const after = await inventory.receipt(r.id);
    expect(after.status).toBe(ReceiptStatus.CONFIRMED); // rollback cả trạng thái
    // BE báo sẵn cho FE: không hoàn được + thiếu bao nhiêu.
    expect(after.canRevert).toBe(false);
    expect(after.revertShortages).toEqual([
      expect.objectContaining({ required: 5, available: 3 }),
    ]);
    expect(
      await prisma.stockMovement.count({
        where: { variantId: id, type: StockMovementType.RECEIPT_REVERT },
      }),
    ).toBe(0);
  });

  it('hoàn phiếu đúng bằng tồn hiện tại (>=) được; một dòng thiếu thì cả phiếu không hoàn', async () => {
    const a = await makeVariant(0, 0);
    const b = await makeVariant(0, 0);
    const r = await inventory.createReceipt({
      items: [
        { variantId: a, quantity: 4, unitCost: 100 },
        { variantId: b, quantity: 4, unitCost: 100 },
      ],
    });
    await inventory.confirmReceipt(r.id);
    await prisma.$transaction((tx) =>
      inventory.applyMovement(tx, {
        variantId: b,
        delta: -1,
        type: StockMovementType.ORDER,
      }),
    );

    await expect(inventory.revertReceipt(r.id)).rejects.toBeDefined();
    expect(await stockOf(a)).toBe(4); // dòng đủ hàng cũng không bị trừ
    expect(await stockOf(b)).toBe(3);

    // Bù lại đủ hàng cho b (tồn = 4 = SL phiếu) -> hoàn được, về 0.
    await inventory.adjustStock({ variantId: b, newQuantity: 4, reason: 'bù' });
    await inventory.revertReceipt(r.id);
    expect(await stockOf(a)).toBe(0);
    expect(await stockOf(b)).toBe(0);
    const va = await prisma.productVariant.findUniqueOrThrow({
      where: { id: a },
    });
    expect(va.costPrice).toBe(0); // hết hàng -> về giá vốn trước khi nhập
  });

  it('chỉ phiếu đã nhập kho mới hoàn được; hoàn hai lần bị từ chối', async () => {
    const id = await makeVariant(0);
    const r = await inventory.createReceipt({
      items: [{ variantId: id, quantity: 1, unitCost: 1 }],
    });
    await expect(inventory.revertReceipt(r.id)).rejects.toMatchObject({
      i18nKey: I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_CONFIRMED,
    });
    await inventory.confirmReceipt(r.id);
    await inventory.revertReceipt(r.id);
    await expect(inventory.revertReceipt(r.id)).rejects.toMatchObject({
      i18nKey: I18N_KEYS.ERRORS.BUSINESS.INVENTORY.RECEIPT_NOT_CONFIRMED,
    });
    expect(await stockOf(id)).toBe(0);
  });

  it('adjustStock: ghi chênh lệch + lý do; không đổi thì không ghi sổ', async () => {
    const id = await makeVariant(8);
    await inventory.adjustStock(
      { variantId: id, newQuantity: 5, reason: 'Kiểm kho hụt' },
      'admin-2',
    );
    expect(await stockOf(id)).toBe(5);
    const m = await prisma.stockMovement.findFirstOrThrow({
      where: { variantId: id, type: StockMovementType.ADJUSTMENT },
    });
    expect(m).toMatchObject({
      quantity: -3,
      balanceAfter: 5,
      reason: 'Kiểm kho hụt',
      createdById: 'admin-2',
    });

    await inventory.adjustStock({
      variantId: id,
      newQuantity: 5,
      reason: 'không đổi',
    });
    expect(await prisma.stockMovement.count({ where: { variantId: id } })).toBe(
      1,
    );
  });

  it('không trừ quá tồn: ném lỗi, tồn và sổ không đổi', async () => {
    const id = await makeVariant(2);
    await expect(
      prisma.$transaction((tx) =>
        inventory.applyMovement(tx, {
          variantId: id,
          delta: -3,
          type: StockMovementType.ORDER,
        }),
      ),
    ).rejects.toBeDefined();
    expect(await stockOf(id)).toBe(2);
    expect(await prisma.stockMovement.count({ where: { variantId: id } })).toBe(
      0,
    );
  });

  it('hai lần trừ đồng thời trên tồn 1: chỉ một lần thành công', async () => {
    const id = await makeVariant(1);
    const attempt = () =>
      prisma.$transaction((tx) =>
        inventory.applyMovement(tx, {
          variantId: id,
          delta: -1,
          type: StockMovementType.ORDER,
        }),
      );
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stockOf(id)).toBe(0);
    expect(await prisma.stockMovement.count({ where: { variantId: id } })).toBe(
      1,
    );
    await expectLedgerConsistent(id);
  });

  it('đơn hàng: tạo đơn trừ kho (ORDER), huỷ đơn hoàn kho (ORDER_CANCEL)', async () => {
    const id = await makeVariant(5);
    const order = await orders.create({
      contactPhone: '0900000000',
      shippingName: 'A',
      shippingPhone: '0900000000',
      shippingAddress: '1 X',
      shippingWard: 'W',
      shippingProvince: 'P',
      paymentMethod: PaymentMethod.COD,
      items: [{ variantId: id, quantity: 2 }],
    });
    expect(await stockOf(id)).toBe(3);

    await orders.updateStatus({ id: order.id, status: OrderStatus.CANCELLED });
    expect(await stockOf(id)).toBe(5);

    const rows = await prisma.stockMovement.findMany({
      where: { variantId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => [r.type, r.quantity, r.orderId])).toEqual([
      [StockMovementType.ORDER, -2, order.id],
      [StockMovementType.ORDER_CANCEL, 2, order.id],
    ]);
    await expectLedgerConsistent(id);
  });

  it('đặt đơn vượt tồn: từ chối, không tạo đơn, tồn không đổi', async () => {
    const id = await makeVariant(1);
    const before = await prisma.order.count();
    await expect(
      orders.create({
        contactPhone: '0900000000',
        shippingName: 'A',
        shippingPhone: '0900000000',
        shippingAddress: '1 X',
        shippingWard: 'W',
        shippingProvince: 'P',
        paymentMethod: PaymentMethod.COD,
        items: [{ variantId: id, quantity: 2 }],
      }),
    ).rejects.toBeDefined();
    expect(await prisma.order.count()).toBe(before);
    expect(await stockOf(id)).toBe(1);
  });
});
