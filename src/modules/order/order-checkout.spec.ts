import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import type { PubSubEngine } from 'graphql-subscriptions';

import {
  FREE_SHIPPING_THRESHOLD,
  I18N_KEYS,
  SHIPPING_FLAT_FEE,
} from '@/common/constants';
import { AppException } from '@/common/exceptions';
import {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  StockMovementType,
} from '@/common/graphql/prisma-enums';
import { PrismaService } from '@/prisma/prisma.service';

import { AddressService } from '../address/address.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  ADMIN_NOTIFICATION_CREATED,
  NotificationService,
} from '../notification/notification.service';
import type { CheckoutInput } from './dto/checkout.input';
import { OrderService } from './order.service';

/**
 * Integration test checkout trên DB thật (khoá giỏ, rollback, trừ kho chỉ kiểm
 * chứng được trên Postgres). Chỉ chạy khi có TEST_DATABASE_URL — xem `yarn test:db`.
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run('OrderService.checkout (DB)', () => {
  let prisma: PrismaService;
  let orders: OrderService;
  /** PubSub giả: ghi lại các thông báo realtime đã đẩy. */
  const publish = jest.fn<
    Promise<void>,
    [string, { adminNotificationCreated: { orderId: string; read: boolean } }]
  >();
  let notifications: NotificationService;
  let categoryId: string;
  let seq = 0;

  const PHONE = '0901 234 567';
  // Mã chính thức (nạp sẵn bởi migration add_admin_units).
  const HCM = '79';
  const BEN_THANH = '26743'; // Phường Bến Thành, TP.HCM
  const BA_DINH = '00004'; // Phường Ba Đình, Hà Nội
  const form = (cartToken: string): CheckoutInput => ({
    cartToken,
    contactPhone: PHONE,
    contactEmail: 'khach@example.com',
    shippingName: 'Nguyễn Văn A',
    shippingPhone: PHONE,
    shippingAddress: '12 Lê Lợi',
    shippingProvinceCode: HCM,
    shippingWardCode: BEN_THANH,
    note: 'Giao giờ hành chính',
  });

  beforeAll(async () => {
    prisma = new PrismaService({
      get: () => url,
    } as unknown as ConfigService<never>);
    await prisma.onModuleInit();
    orders = new OrderService(
      prisma,
      new InventoryService(prisma),
      new AddressService(prisma),
      (notifications = new NotificationService(prisma, {
        publish,
      } as unknown as PubSubEngine)),
    );
    const category = await prisma.category.create({
      data: { name: 'Checkout test', slug: `checkout-test-${Date.now()}` },
    });
    categoryId = category.id;
  });

  beforeEach(() => publish.mockReset().mockResolvedValue());

  /** Số lần đẩy realtime cho một đơn. */
  const notified = (orderId: string) =>
    publish.mock.calls.filter(
      ([, p]) => p.adminNotificationCreated.orderId === orderId,
    ).length;
  /** Số thông báo đã lưu DB cho một đơn. */
  const storedFor = (orderId: string) =>
    prisma.adminNotification.count({ where: { orderId } });

  afterAll(async () => {
    const products = { product: { categoryId } };
    await prisma.cart.deleteMany({
      where: { items: { some: { variant: products } } },
    });
    await prisma.cart.deleteMany({ where: { token: { startsWith: 'test_' } } });
    const orderIds = (
      await prisma.order.findMany({
        where: { items: { some: { variant: products } } },
        select: { id: true },
      })
    ).map((o) => o.id);
    await prisma.stockMovement.deleteMany({ where: { variant: products } });
    await prisma.adminNotification.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@notif.test' } },
    });
    await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST' } } });
    await prisma.productVariant.deleteMany({ where: products });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.onModuleDestroy();
  });

  async function makeVariant(
    stock: number,
    price = 200_000,
    costPrice = 80_000,
  ) {
    seq += 1;
    const product = await prisma.product.create({
      data: {
        categoryId,
        name: `Áo test ${seq}`,
        slug: `ao-test-${Date.now()}-${seq}`,
        status: 'ACTIVE',
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `CHK-${Date.now()}-${seq}`,
        price,
        costPrice,
        stockQuantity: stock,
      },
    });
    return variant.id;
  }

  async function makeCart(
    lines: [variantId: string, quantity: number][],
    couponCode?: string,
  ) {
    const cart = await prisma.cart.create({
      data: {
        token: `test_${randomBytes(16).toString('hex')}`,
        couponCode,
        items: {
          create: lines.map(([variantId, quantity]) => ({
            variantId,
            quantity,
          })),
        },
      },
    });
    return cart.token;
  }

  async function makeCoupon(overrides: { usageLimit?: number } = {}) {
    seq += 1;
    return prisma.coupon.create({
      data: {
        code: `TEST${Date.now()}${seq}`,
        discountType: DiscountType.FIXED,
        discountValue: 50_000,
        ...overrides,
      },
    });
  }

  const stockOf = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } }))
      .stockQuantity;

  const cartOf = (token: string) =>
    prisma.cart.findUniqueOrThrow({ where: { token } });

  const ordersFor = (variantId: string) =>
    prisma.order.count({ where: { items: { some: { variantId } } } });

  async function expectAppError(promise: Promise<unknown>, i18nKey: string) {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).i18nKey).toBe(i18nKey);
  }

  it('tạo đơn COD: giá & phí ship do server tính, trừ kho, chốt giỏ', async () => {
    const v = await makeVariant(10, 200_000, 80_000);
    const token = await makeCart([[v, 2]]);

    const order = await orders.checkout(form(token));

    expect(order).toMatchObject({
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.COD,
      totalAmount: 400_000,
      discountAmount: 0,
      shippingFee: SHIPPING_FLAT_FEE,
      finalAmount: 400_000 + SHIPPING_FLAT_FEE,
      contactPhone: PHONE,
      shippingName: 'Nguyễn Văn A',
      note: 'Giao giờ hành chính',
      // Tên lấy từ danh mục theo mã, không tin chữ từ client.
      shippingProvince: 'Thành phố Hồ Chí Minh',
      shippingProvinceCode: HCM,
      shippingWard: 'Phường Bến Thành',
      shippingWardCode: BEN_THANH,
      shippingDistrict: null,
    });
    expect(order.orderCode).toMatch(/^DH\d{14}$/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      variantId: v,
      quantity: 2,
      unitPrice: 200_000,
      unitCost: 80_000,
      lineTotal: 400_000,
    });

    expect(await stockOf(v)).toBe(8);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(ADMIN_NOTIFICATION_CREATED, {
      adminNotificationCreated: expect.objectContaining({
        orderId: order.id,
        title: `Đơn mới ${order.orderCode}`,
        body: `Nguyễn Văn A · 2 SP · 430.000 ₫`,
        link: `/admin/orders/${order.id}`,
        read: false,
      }),
    });
    expect(await storedFor(order.id)).toBe(1);
    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { variantId: v, orderId: order.id },
    });
    expect(movement).toMatchObject({
      type: StockMovementType.ORDER,
      quantity: -2,
      balanceAfter: 8,
    });

    const cart = await cartOf(token);
    expect(cart.status).toBe('CONVERTED');
    expect(cart.orderId).toBe(order.id);
  });

  it('realtime đẩy sau khi commit: lúc đó đơn và thông báo đã đọc được từ DB', async () => {
    const v = await makeVariant(5);
    let visible = false;
    publish.mockImplementation(async (_topic, payload) => {
      const { orderId } = payload.adminNotificationCreated;
      visible =
        (await prisma.order.count({ where: { id: orderId } })) === 1 &&
        (await storedFor(orderId)) === 1;
    });

    await orders.checkout(form(await makeCart([[v, 1]])));

    expect(visible).toBe(true);
  });

  it('Redis lỗi khi đẩy realtime: đơn vẫn tạo, thông báo vẫn còn trong DB', async () => {
    const v = await makeVariant(5);
    publish.mockRejectedValue(new Error('redis down'));

    const order = await orders.checkout(form(await makeCart([[v, 1]])));

    expect(await storedFor(order.id)).toBe(1);
    expect(await stockOf(v)).toBe(4);
  });

  it('miễn phí ship khi tạm tính đạt ngưỡng', async () => {
    const v = await makeVariant(5, FREE_SHIPPING_THRESHOLD);
    const token = await makeCart([[v, 1]]);

    const order = await orders.checkout(form(token));

    expect(order.shippingFee).toBe(0);
    expect(order.finalAmount).toBe(FREE_SHIPPING_THRESHOLD);
  });

  it('idempotent: checkout lại cùng giỏ trả về đơn cũ, không trừ kho lần nữa', async () => {
    const v = await makeVariant(10);
    const token = await makeCart([[v, 3]]);

    const first = await orders.checkout(form(token));
    const second = await orders.checkout(form(token));

    expect(second.id).toBe(first.id);
    expect(second.orderCode).toBe(first.orderCode);
    // Chỉ báo admin một lần, lần gọi lặp lại không báo.
    expect(notified(first.id)).toBe(1);
    expect(await storedFor(first.id)).toBe(1);
    expect(await ordersFor(v)).toBe(1);
    expect(await stockOf(v)).toBe(7);
  });

  it('hai request checkout đồng thời chỉ tạo một đơn', async () => {
    const v = await makeVariant(10);
    const token = await makeCart([[v, 2]]);

    const [a, b] = await Promise.all([
      orders.checkout(form(token)),
      orders.checkout(form(token)),
    ]);

    expect(a.id).toBe(b.id);
    expect(await ordersFor(v)).toBe(1);
    expect(notified(a.id)).toBe(1);
    expect(await storedFor(a.id)).toBe(1);
    expect(await stockOf(v)).toBe(8);
  });

  it('kho không đủ lúc checkout: rollback toàn bộ (không đơn, giỏ giữ nguyên, coupon không tốn lượt)', async () => {
    const plenty = await makeVariant(10);
    const scarce = await makeVariant(1);
    const coupon = await makeCoupon();
    const token = await makeCart(
      [
        [plenty, 2],
        [scarce, 2],
      ],
      coupon.code,
    );

    await expectAppError(
      orders.checkout(form(token)),
      I18N_KEYS.ERRORS.BUSINESS.ORDER.INSUFFICIENT_STOCK,
    );

    expect(await ordersFor(plenty)).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(
      await prisma.adminNotification.count({
        where: { order: { items: { some: { variantId: plenty } } } },
      }),
    ).toBe(0);
    expect(await stockOf(plenty)).toBe(10);
    expect(await stockOf(scarce)).toBe(1);
    expect((await cartOf(token)).status).toBe('ACTIVE');
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
        .usedCount,
    ).toBe(0);
  });

  it('biến thể bị tắt sau khi thêm vào giỏ -> VARIANT_NOT_FOUND', async () => {
    const v = await makeVariant(5);
    const token = await makeCart([[v, 1]]);
    await prisma.productVariant.update({
      where: { id: v },
      data: { isActive: false },
    });

    await expectAppError(
      orders.checkout(form(token)),
      I18N_KEYS.ERRORS.BUSINESS.ORDER.VARIANT_NOT_FOUND,
    );
    expect((await cartOf(token)).status).toBe('ACTIVE');
  });

  it('giỏ rỗng -> EMPTY_ITEMS; token lạ -> CART.NOT_FOUND', async () => {
    const empty = await makeCart([]);

    await expectAppError(
      orders.checkout(form(empty)),
      I18N_KEYS.ERRORS.BUSINESS.ORDER.EMPTY_ITEMS,
    );
    await expectAppError(
      orders.checkout(form('test_khong-ton-tai-0000000000')),
      I18N_KEYS.ERRORS.BUSINESS.CART.NOT_FOUND,
    );
  });

  it('áp coupon của giỏ, tăng lượt dùng; hết lượt thì giỏ sau bị từ chối', async () => {
    const v = await makeVariant(10, 300_000);
    const coupon = await makeCoupon({ usageLimit: 1 });
    const tokenA = await makeCart([[v, 1]], coupon.code);
    const tokenB = await makeCart([[v, 1]], coupon.code);

    const order = await orders.checkout(form(tokenA));

    expect(order).toMatchObject({
      couponCode: coupon.code,
      discountAmount: 50_000,
      finalAmount: 300_000 - 50_000 + SHIPPING_FLAT_FEE,
    });
    await expectAppError(
      orders.checkout(form(tokenB)),
      I18N_KEYS.ERRORS.BUSINESS.COUPON.USAGE_LIMIT,
    );
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
        .usedCount,
    ).toBe(1);
    expect(await stockOf(v)).toBe(9);
  });

  it('huỷ đơn hoàn kho và trả lượt coupon; huỷ lần nữa bị chặn', async () => {
    const v = await makeVariant(5);
    const coupon = await makeCoupon({ usageLimit: 1 });
    const token = await makeCart([[v, 2]], coupon.code);
    const order = await orders.checkout(form(token));
    expect(await stockOf(v)).toBe(3);

    const cancelled = await orders.updateStatus({
      id: order.id,
      status: OrderStatus.CANCELLED,
    });

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(await stockOf(v)).toBe(5);
    expect(
      (await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
        .usedCount,
    ).toBe(0);
    // Đã CANCELLED thì không còn bước nào hợp lệ -> không hoàn kho lần hai.
    await expect(
      orders.updateStatus({ id: order.id, status: OrderStatus.CANCELLED }),
    ).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    expect(await stockOf(v)).toBe(5);
  });

  it('hai request huỷ đồng thời chỉ hoàn kho một lần', async () => {
    const v = await makeVariant(5);
    const token = await makeCart([[v, 2]]);
    const order = await orders.checkout(form(token));

    const results = await Promise.allSettled([
      orders.updateStatus({ id: order.id, status: OrderStatus.CANCELLED }),
      orders.updateStatus({ id: order.id, status: OrderStatus.CANCELLED }),
    ]);

    expect(
      results.filter((r) => r.status === 'fulfilled').length,
    ).toBeGreaterThanOrEqual(1);
    expect(await stockOf(v)).toBe(5);
  });

  it.each([
    [
      'tỉnh không tồn tại',
      { shippingProvinceCode: '00' },
      'shippingProvinceCode',
    ],
    ['xã không tồn tại', { shippingWardCode: '99999' }, 'shippingWardCode'],
    ['xã không thuộc tỉnh', { shippingWardCode: BA_DINH }, 'shippingWardCode'],
  ])(
    'địa chỉ sai (%s) -> ADDRESS.INVALID, không tạo đơn, không trừ kho',
    async (_label, override, field) => {
      const v = await makeVariant(5);
      const token = await makeCart([[v, 1]]);

      const error = await orders
        .checkout({ ...form(token), ...override })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).i18nKey).toBe(
        I18N_KEYS.ERRORS.BUSINESS.ADDRESS.INVALID,
      );
      expect((error as AppException).params).toEqual({
        fields: [{ field, rule: 'adminUnit' }],
      });
      expect(await ordersFor(v)).toBe(0);
      expect(await stockOf(v)).toBe(5);
      expect((await cartOf(token)).status).toBe('ACTIVE');
    },
  );

  it('tra cứu đơn: khớp SĐT bất kể định dạng, sai SĐT -> NOT_FOUND', async () => {
    const v = await makeVariant(5);
    const order = await orders.checkout(form(await makeCart([[v, 1]])));

    for (const phone of ['0901234567', '+84 901 234 567', '84901234567']) {
      await expect(
        orders.lookup(order.orderCode.toLowerCase(), phone),
      ).resolves.toMatchObject({ id: order.id });
    }
    await expectAppError(
      orders.lookup(order.orderCode, '0999999999'),
      I18N_KEYS.ERRORS.BUSINESS.ORDER.ORDER_NOT_FOUND,
    );
    await expectAppError(
      orders.lookup(order.orderCode, ''),
      I18N_KEYS.ERRORS.BUSINESS.ORDER.ORDER_NOT_FOUND,
    );
  });

  describe('thông báo admin: đã đọc theo từng admin', () => {
    async function makeAdmin() {
      seq += 1;
      return prisma.user.create({
        data: {
          email: `admin-${Date.now()}-${seq}@notif.test`,
          passwordHash: 'x',
          role: 'ADMIN',
        },
      });
    }

    async function orderWithNotification() {
      const v = await makeVariant(5);
      return orders.checkout(form(await makeCart([[v, 1]])));
    }

    it('list có field read riêng cho từng admin; markRead(orderId) chỉ ảnh hưởng admin đó', async () => {
      const [alice, bob] = [await makeAdmin(), await makeAdmin()];
      const order = await orderWithNotification();
      const aliceBefore = await notifications.unreadCount(alice.id);
      const bobBefore = await notifications.unreadCount(bob.id);

      const remaining = await notifications.markRead(alice.id, {
        orderId: order.id,
      });

      expect(remaining).toBe(aliceBefore - 1);
      expect(await notifications.unreadCount(bob.id)).toBe(bobBefore);
      const find = async (userId: string) =>
        (await notifications.list(userId, { take: 100 })).nodes.find(
          (n) => n.orderId === order.id,
        );
      expect(await find(alice.id)).toMatchObject({ read: true });
      expect(await find(bob.id)).toMatchObject({ read: false });

      // Đánh dấu lại không lỗi, không đếm trùng.
      await expect(
        notifications.markRead(alice.id, { orderId: order.id }),
      ).resolves.toBe(remaining);
    });

    it('markRead(ids) và markRead(all)', async () => {
      const admin = await makeAdmin();
      const o1 = await orderWithNotification();
      const o2 = await orderWithNotification();
      const n1 = await prisma.adminNotification.findFirstOrThrow({
        where: { orderId: o1.id },
      });
      const before = await notifications.unreadCount(admin.id);

      await expect(
        notifications.markRead(admin.id, { ids: [n1.id] }),
      ).resolves.toBe(before - 1);
      await expect(
        notifications.markRead(admin.id, { all: true }),
      ).resolves.toBe(0);
      const page = await notifications.list(admin.id, { take: 100 });
      expect(
        page.nodes.filter((n) => [o1.id, o2.id].includes(n.orderId ?? '')),
      ).toEqual([
        expect.objectContaining({ read: true }),
        expect.objectContaining({ read: true }),
      ]);
    });

    it('markRead phải chọn đúng một cách: ids / orderId / all', async () => {
      const admin = await makeAdmin();

      for (const input of [
        {},
        { all: true, orderId: '00000000-0000-0000-0000-000000000000' },
      ]) {
        await expectAppError(
          notifications.markRead(admin.id, input),
          I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        );
      }
    });

    it('list mới nhất trước, phân trang đúng', async () => {
      const admin = await makeAdmin();
      const older = await orderWithNotification();
      const newer = await orderWithNotification();

      const page = await notifications.list(admin.id, { take: 2 });

      const ids = page.nodes.map((n) => n.orderId);
      expect(ids.indexOf(newer.id)).toBeLessThan(
        ids.includes(older.id) ? ids.indexOf(older.id) : Infinity,
      );
      expect(page.nodes).toHaveLength(2);
      expect(page.totalCount).toBeGreaterThanOrEqual(2);
    });

    it('purgeOld xoá thông báo cũ hơn 90 ngày, giữ thông báo mới', async () => {
      const oldOrder = await orderWithNotification();
      const freshOrder = await orderWithNotification();
      const old = await prisma.adminNotification.findFirstOrThrow({
        where: { orderId: oldOrder.id },
      });
      await prisma.adminNotification.update({
        where: { id: old.id },
        data: { createdAt: new Date(Date.now() - 91 * 24 * 3600 * 1000) },
      });

      expect(await notifications.purgeOld()).toBeGreaterThanOrEqual(1);
      expect(await storedFor(oldOrder.id)).toBe(0);
      expect(await storedFor(freshOrder.id)).toBe(1);
      // Đơn hàng không bị ảnh hưởng.
      expect(await prisma.order.count({ where: { id: oldOrder.id } })).toBe(1);
    });
  });
});
