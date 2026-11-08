/**
 * Xuất dữ liệu catalog hiện tại trong DB ra prisma/snapshot/catalog.json
 * (danh mục, bộ sưu tập, sản phẩm, biến thể, thuộc tính, ảnh). Không xuất đơn hàng/khách hàng/user.
 *   yarn db:export
 */
import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { SNAPSHOT_FILE, type Snapshot } from './lib/snapshot';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const productIds = products.map((p) => p.id);

    const variants = await prisma.productVariant.findMany({
      where: { deletedAt: null, productId: { in: productIds } },
      orderBy: { createdAt: 'asc' },
    });
    const variantIds = variants.map((v) => v.id);

    const snapshot: Snapshot = {
      category: await prisma.category.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      collection: await prisma.collection.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      product: products,
      productCollection: await prisma.productCollection.findMany({
        where: { productId: { in: productIds } },
      }),
      attribute: await prisma.attribute.findMany(),
      attributeValue: await prisma.attributeValue.findMany(),
      productVariant: variants,
      variantAttributeValue: await prisma.variantAttributeValue.findMany({
        where: { variantId: { in: variantIds } },
      }),
      productImage: await prisma.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
      }),
    };

    const file = join(process.cwd(), SNAPSHOT_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n');
    for (const [table, rows] of Object.entries(snapshot)) {
      console.log(`${table}: ${rows.length}`);
    }
    console.log(`Wrote ${SNAPSHOT_FILE}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
