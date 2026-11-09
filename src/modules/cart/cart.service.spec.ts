import {
  CART_MAX_LINE_QUANTITY,
  FREE_SHIPPING_THRESHOLD,
  I18N_KEYS,
  SHIPPING_FLAT_FEE,
} from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { DiscountType, ProductStatus } from '@/common/graphql/prisma-enums';
import type { PrismaService } from '@/prisma/prisma.service';

import { CartService } from './cart.service';
import { CartLineIssue } from './entities/cart.entity';

/* ───────── fixtures ───────── */

const TOKEN = 'tok_0123456789abcdef0123456789';

type FakeVariant = ReturnType<typeof makeVariant>;

function makeVariant(
  overrides: {
    id?: string;
    price?: number;
    stockQuantity?: number;
    isActive?: boolean;
    deletedAt?: Date | null;
    productStatus?: ProductStatus;
    productDeletedAt?: Date | null;
  } = {},
) {
  const id = overrides.id ?? 'v1';
  return {
    id,
    productId: `p-${id}`,
    sku: `SKU-${id}`,
    price: overrides.price ?? 100_000,
    costPrice: 40_000,
    compareAtPrice: null,
    stockQuantity: overrides.stockQuantity ?? 20,
    isActive: overrides.isActive ?? true,
    deletedAt: overrides.deletedAt ?? null,
    product: {
      id: `p-${id}`,
      name: `Áo ${id}`,
      slug: `ao-${id}`,
      thumbnail: '/thumb.jpg',
      status: overrides.productStatus ?? ProductStatus.ACTIVE,
      deletedAt: overrides.productDeletedAt ?? null,
      images: [
        { url: '/shared.jpg', attributeValueId: null },
        { url: '/black.jpg', attributeValueId: 'color-black' },
      ],
    },
    attributes: [
      {
        attribute: { name: 'Màu sắc' },
        attributeValueId: 'color-black',
        attributeValue: { value: 'Đen' },
      },
      {
        attribute: { name: 'Size' },
        attributeValueId: 'size-m',
        attributeValue: { value: 'M' },
      },
    ],
  };
}

function makeCart(
  lines: [FakeVariant, number][],
  overrides: { couponCode?: string | null } = {},
) {
  return {
    id: 'cart-1',
    token: TOKEN,
    customerId: null,
    couponCode: overrides.couponCode ?? null,
    status: 'ACTIVE',
    orderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: lines.map(([variant, quantity], i) => ({
      id: `item-${i}`,
      cartId: 'cart-1',
      variantId: variant.id,
      quantity,
      addedAt: new Date(),
      variant,
    })),
  };
}

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'SALE10',
    discountType: DiscountType.PERCENT,
    discountValue: 10,
    minOrderValue: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    usedCount: 0,
    startDate: null,
    endDate: null,
    isActive: true,
    ...overrides,
  };
}

/* ───────── prisma mock ───────── */

function createPrismaMock() {
  return {
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: { findUnique: jest.fn() },
    coupon: { findUnique: jest.fn() },
  };
}

async function expectAppError(promise: Promise<unknown>, i18nKey: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => {
    expect(error.i18nKey).toBe(i18nKey);
  });
}

describe('CartService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CartService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CartService(prisma as unknown as PrismaService);
  });

  /** Sau mỗi thao tác service reload giỏ qua cart.update -> trả về `cart`. */
  const reloadReturns = (cart: ReturnType<typeof makeCart>) =>
    prisma.cart.update.mockResolvedValue(cart);

  describe('get / view', () => {
    it('trả null khi token không có giỏ ACTIVE', async () => {
      prisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.get(TOKEN)).resolves.toBeNull();
      expect(prisma.cart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: TOKEN, status: 'ACTIVE' } }),
      );
    });

    it('tính tạm tính, số lượng, phí ship và dữ liệu hiển thị của dòng', async () => {
      const v1 = makeVariant({ id: 'v1', price: 150_000 });
      const v2 = makeVariant({ id: 'v2', price: 100_000 });
      prisma.cart.findFirst.mockResolvedValue(
        makeCart([
          [v1, 2],
          [v2, 1],
        ]),
      );

      const cart = await service.get(TOKEN);

      expect(cart).toMatchObject({
        token: TOKEN,
        itemCount: 3,
        subtotal: 400_000,
        discountAmount: 0,
        shippingFee: SHIPPING_FLAT_FEE,
        total: 400_000 + SHIPPING_FLAT_FEE,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        canCheckout: true,
      });
      expect(cart!.items[0]).toMatchObject({
        variantId: 'v1',
        productName: 'Áo v1',
        productSlug: 'ao-v1',
        color: 'Đen',
        size: 'M',
        image: '/black.jpg',
        unitPrice: 150_000,
        quantity: 2,
        lineTotal: 300_000,
        maxQuantity: CART_MAX_LINE_QUANTITY,
        issue: null,
      });
      // Không lộ giá vốn ra ngoài.
      expect(cart!.items[0]).not.toHaveProperty('costPrice');
    });

    it('miễn phí ship khi tạm tính đạt ngưỡng', async () => {
      const v = makeVariant({ price: FREE_SHIPPING_THRESHOLD });
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 1]]));

      const cart = await service.get(TOKEN);

      expect(cart!.shippingFee).toBe(0);
      expect(cart!.total).toBe(FREE_SHIPPING_THRESHOLD);
    });

    it.each([
      ['hết hàng', { stockQuantity: 0 }, 1, CartLineIssue.OUT_OF_STOCK, 0],
      [
        'tồn ít hơn giỏ',
        { stockQuantity: 2 },
        3,
        CartLineIssue.INSUFFICIENT_STOCK,
        2,
      ],
      ['biến thể tắt', { isActive: false }, 1, CartLineIssue.UNAVAILABLE, 0],
      [
        'biến thể đã xoá',
        { deletedAt: new Date() },
        1,
        CartLineIssue.UNAVAILABLE,
        0,
      ],
      [
        'sản phẩm ngừng bán',
        { productStatus: ProductStatus.ARCHIVED },
        1,
        CartLineIssue.UNAVAILABLE,
        0,
      ],
      [
        'sản phẩm đã xoá',
        { productDeletedAt: new Date() },
        1,
        CartLineIssue.UNAVAILABLE,
        0,
      ],
    ])(
      'đánh dấu dòng %s và chặn checkout',
      async (_label, overrides, quantity, issue, maxQuantity) => {
        prisma.cart.findFirst.mockResolvedValue(
          makeCart([[makeVariant(overrides), quantity]]),
        );

        const cart = await service.get(TOKEN);

        expect(cart!.items[0].issue).toBe(issue);
        expect(cart!.items[0].maxQuantity).toBe(maxQuantity);
        expect(cart!.canCheckout).toBe(false);
      },
    );

    it('giỏ rỗng không checkout được và không tính phí ship', async () => {
      prisma.cart.findFirst.mockResolvedValue(makeCart([]));

      const cart = await service.get(TOKEN);

      expect(cart).toMatchObject({
        itemCount: 0,
        subtotal: 0,
        shippingFee: 0,
        total: 0,
        canCheckout: false,
      });
    });

    it('áp coupon PERCENT có trần giảm, phí ship tính trên số tiền sau giảm', async () => {
      prisma.cart.findFirst.mockResolvedValue(
        makeCart([[makeVariant({ price: 1_000_000 }), 1]], {
          couponCode: 'SALE10',
        }),
      );
      prisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ discountValue: 10, maxDiscountAmount: 50_000 }),
      );

      const cart = await service.get(TOKEN);

      // 10% = 100k nhưng trần 50k -> còn 950k < ngưỡng freeship -> tính phí.
      expect(cart).toMatchObject({
        discountAmount: 50_000,
        shippingFee: SHIPPING_FLAT_FEE,
        total: 1_000_000 - 50_000 + SHIPPING_FLAT_FEE,
        couponError: null,
        canCheckout: true,
      });
    });

    it('coupon không còn hợp lệ: báo couponError, không giảm, chặn checkout', async () => {
      prisma.cart.findFirst.mockResolvedValue(
        makeCart([[makeVariant({ price: 100_000 }), 1]], {
          couponCode: 'SALE10',
        }),
      );
      prisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ minOrderValue: 500_000 }),
      );

      const cart = await service.get(TOKEN);

      expect(cart).toMatchObject({
        couponCode: 'SALE10',
        couponError: I18N_KEYS.ERRORS.BUSINESS.COUPON.MIN_ORDER_VALUE,
        discountAmount: 0,
        canCheckout: false,
      });
    });
  });

  describe('addItem', () => {
    it('không có token: tạo giỏ mới với token ngẫu nhiên rồi thêm dòng', async () => {
      const v = makeVariant();
      prisma.productVariant.findUnique.mockResolvedValue(v);
      prisma.cart.create.mockResolvedValue({ id: 'cart-1' });
      reloadReturns(makeCart([[v, 2]]));

      const cart = await service.addItem({ variantId: 'v1', quantity: 2 });

      const token = prisma.cart.create.mock.calls[0][0].data.token as string;
      expect(token).toMatch(/^[\w-]{43}$/); // 32 byte base64url
      expect(prisma.cart.findFirst).not.toHaveBeenCalled();
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_variantId: { cartId: 'cart-1', variantId: 'v1' } },
        create: { cartId: 'cart-1', variantId: 'v1', quantity: 2 },
        update: { quantity: 2 },
      });
      expect(cart.itemCount).toBe(2);
    });

    it('token hợp lệ: cộng dồn vào dòng đã có, không tạo giỏ mới', async () => {
      const v = makeVariant();
      prisma.productVariant.findUnique.mockResolvedValue(v);
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 3]]));
      reloadReturns(makeCart([[v, 5]]));

      await service.addItem({ cartToken: TOKEN, variantId: 'v1', quantity: 2 });

      expect(prisma.cart.create).not.toHaveBeenCalled();
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 5 } }),
      );
    });

    it('token của giỏ đã checkout / hết hạn: tạo giỏ mới', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      prisma.cart.findFirst.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue({ id: 'cart-2' });
      reloadReturns(makeCart([]));

      await service.addItem({ cartToken: TOKEN, variantId: 'v1', quantity: 1 });

      expect(prisma.cart.create).toHaveBeenCalledTimes(1);
    });

    it('vượt tồn kho (tính cả số đã có trong giỏ) -> INSUFFICIENT_STOCK', async () => {
      const v = makeVariant({ stockQuantity: 4 });
      prisma.productVariant.findUnique.mockResolvedValue(v);
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 3]]));

      await expectAppError(
        service.addItem({ cartToken: TOKEN, variantId: 'v1', quantity: 2 }),
        I18N_KEYS.ERRORS.BUSINESS.CART.INSUFFICIENT_STOCK,
      );
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('vượt giới hạn mỗi dòng -> MAX_QUANTITY', async () => {
      const v = makeVariant({ stockQuantity: 100 });
      prisma.productVariant.findUnique.mockResolvedValue(v);
      prisma.cart.findFirst.mockResolvedValue(
        makeCart([[v, CART_MAX_LINE_QUANTITY]]),
      );

      await expectAppError(
        service.addItem({ cartToken: TOKEN, variantId: 'v1', quantity: 1 }),
        I18N_KEYS.ERRORS.BUSINESS.CART.MAX_QUANTITY,
      );
    });

    it.each([
      ['không tồn tại', null],
      ['đã tắt', makeVariant({ isActive: false })],
      ['sản phẩm nháp', makeVariant({ productStatus: ProductStatus.DRAFT })],
    ])(
      'biến thể %s -> VARIANT_UNAVAILABLE và không tạo giỏ',
      async (_label, variant) => {
        prisma.productVariant.findUnique.mockResolvedValue(variant);

        await expectAppError(
          service.addItem({ variantId: 'v1', quantity: 1 }),
          I18N_KEYS.ERRORS.BUSINESS.CART.VARIANT_UNAVAILABLE,
        );
        expect(prisma.cart.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('updateItem / removeItem', () => {
    it('giỏ không tồn tại -> CART.NOT_FOUND', async () => {
      prisma.cart.findFirst.mockResolvedValue(null);

      await expectAppError(
        service.updateItem({ cartToken: TOKEN, variantId: 'v1', quantity: 1 }),
        I18N_KEYS.ERRORS.BUSINESS.CART.NOT_FOUND,
      );
    });

    it('quantity = 0 xoá dòng', async () => {
      const v = makeVariant();
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 2]]));
      reloadReturns(makeCart([]));

      const cart = await service.removeItem(TOKEN, 'v1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-0' },
      });
      expect(cart.items).toHaveLength(0);
    });

    it('giảm số lượng được kể cả khi đang vượt tồn (không kiểm tra lại kho)', async () => {
      const v = makeVariant({ stockQuantity: 1 });
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 3]]));
      reloadReturns(makeCart([[v, 2]]));

      await service.updateItem({
        cartToken: TOKEN,
        variantId: 'v1',
        quantity: 2,
      });

      expect(prisma.productVariant.findUnique).not.toHaveBeenCalled();
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-0' },
        data: { quantity: 2 },
      });
    });

    it('tăng số lượng vượt tồn -> INSUFFICIENT_STOCK', async () => {
      const v = makeVariant({ stockQuantity: 3 });
      prisma.cart.findFirst.mockResolvedValue(makeCart([[v, 3]]));
      prisma.productVariant.findUnique.mockResolvedValue(v);

      await expectAppError(
        service.updateItem({ cartToken: TOKEN, variantId: 'v1', quantity: 4 }),
        I18N_KEYS.ERRORS.BUSINESS.CART.INSUFFICIENT_STOCK,
      );
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('cập nhật dòng không có trong giỏ -> VARIANT_UNAVAILABLE', async () => {
      prisma.cart.findFirst.mockResolvedValue(makeCart([]));

      await expectAppError(
        service.updateItem({ cartToken: TOKEN, variantId: 'v9', quantity: 1 }),
        I18N_KEYS.ERRORS.BUSINESS.CART.VARIANT_UNAVAILABLE,
      );
    });
  });

  describe('coupon', () => {
    it('applyCoupon lưu mã chuẩn hoá (in hoa) vào giỏ', async () => {
      const cart = makeCart([[makeVariant({ price: 200_000 }), 1]]);
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.coupon.findUnique.mockResolvedValue(makeCoupon());
      reloadReturns({ ...cart, couponCode: 'SALE10' });

      const result = await service.applyCoupon({
        cartToken: TOKEN,
        code: ' sale10 ',
      });

      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'SALE10' },
      });
      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { couponCode: 'SALE10' },
      });
      expect(result.discountAmount).toBe(20_000);
    });

    it.each([
      ['không tồn tại', null, I18N_KEYS.ERRORS.BUSINESS.COUPON.INVALID],
      [
        'đã tắt',
        makeCoupon({ isActive: false }),
        I18N_KEYS.ERRORS.BUSINESS.COUPON.INVALID,
      ],
      [
        'hết hạn',
        makeCoupon({ endDate: new Date('2020-01-01') }),
        I18N_KEYS.ERRORS.BUSINESS.COUPON.EXPIRED,
      ],
      [
        'hết lượt',
        makeCoupon({ usageLimit: 5, usedCount: 5 }),
        I18N_KEYS.ERRORS.BUSINESS.COUPON.USAGE_LIMIT,
      ],
    ])('applyCoupon mã %s -> lỗi, không lưu', async (_label, coupon, key) => {
      prisma.cart.findFirst.mockResolvedValue(makeCart([[makeVariant(), 1]]));
      prisma.coupon.findUnique.mockResolvedValue(coupon);

      await expectAppError(
        service.applyCoupon({ cartToken: TOKEN, code: 'X' }),
        key,
      );
      expect(prisma.cart.update).not.toHaveBeenCalled();
    });

    it('removeCoupon xoá mã khỏi giỏ', async () => {
      const cart = makeCart([[makeVariant(), 1]], { couponCode: 'SALE10' });
      prisma.cart.findFirst.mockResolvedValue(cart);
      reloadReturns({ ...cart, couponCode: null });

      await service.removeCoupon(TOKEN);

      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { couponCode: null },
      });
    });
  });
});
