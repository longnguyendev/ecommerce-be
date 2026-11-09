import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { CART_TTL_DAYS } from '@/common/constants';
import { PrismaService } from '@/prisma/prisma.service';

import { CartCleanupService } from './cart-cleanup.service';

/** Integration test trên DB thật — chỉ chạy khi có TEST_DATABASE_URL (`yarn test:db`). */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const DAY_MS = 24 * 60 * 60 * 1_000;

run('CartCleanupService (DB)', () => {
  let prisma: PrismaService;
  let cleanup: CartCleanupService;
  let categoryId: string;
  let variantId: string;
  const now = new Date();

  beforeAll(async () => {
    prisma = new PrismaService({
      get: () => url,
    } as unknown as ConfigService<never>);
    await prisma.onModuleInit();
    cleanup = new CartCleanupService(prisma);

    const category = await prisma.category.create({
      data: { name: 'Cleanup test', slug: `cleanup-test-${Date.now()}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: { categoryId, name: 'P', slug: `cleanup-p-${Date.now()}` },
    });
    variantId = (
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `CLN-${Date.now()}`,
          price: 100_000,
          stockQuantity: 5,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({
      where: { token: { startsWith: 'clean_' } },
    });
    await prisma.productVariant.deleteMany({
      where: { product: { categoryId } },
    });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.onModuleDestroy();
  });

  /** Tạo giỏ có updatedAt lùi về `daysAgo` ngày. */
  async function cartIdle(daysAgo: number, status: 'ACTIVE' | 'CONVERTED') {
    const cart = await prisma.cart.create({
      data: {
        token: `clean_${randomBytes(12).toString('hex')}`,
        status,
        items: { create: [{ variantId, quantity: 1 }] },
      },
    });
    // @updatedAt luôn ghi đè -> đặt trực tiếp bằng SQL.
    const at = new Date(now.getTime() - daysAgo * DAY_MS);
    await prisma.$executeRaw`UPDATE "Cart" SET "updatedAt" = ${at} WHERE id = ${cart.id}`;
    return cart.id;
  }

  const exists = async (id: string) =>
    (await prisma.cart.count({ where: { id } })) === 1;

  it(`xoá giỏ không đổi quá ${CART_TTL_DAYS} ngày (cả ACTIVE lẫn CONVERTED), giữ giỏ mới hơn`, async () => {
    const oldActive = await cartIdle(CART_TTL_DAYS + 1, 'ACTIVE');
    const oldConverted = await cartIdle(CART_TTL_DAYS + 5, 'CONVERTED');
    const recent = await cartIdle(CART_TTL_DAYS - 1, 'ACTIVE');
    const fresh = await cartIdle(0, 'ACTIVE');

    const removed = await cleanup.purgeStale(now);

    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await exists(oldActive)).toBe(false);
    expect(await exists(oldConverted)).toBe(false);
    expect(await exists(recent)).toBe(true);
    expect(await exists(fresh)).toBe(true);
    // CartItem của giỏ đã xoá đi theo cascade.
    expect(
      await prisma.cartItem.count({
        where: { cartId: { in: [oldActive, oldConverted] } },
      }),
    ).toBe(0);
    // Biến thể không bị ảnh hưởng.
    expect(
      await prisma.productVariant.count({ where: { id: variantId } }),
    ).toBe(1);
  });

  it('chạy lại khi không còn giỏ cũ thì không xoá gì', async () => {
    await cleanup.purgeStale(now);

    await expect(cleanup.purgeStale(now)).resolves.toBe(0);
  });
});
