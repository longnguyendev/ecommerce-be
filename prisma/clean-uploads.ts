/**
 * Tìm (và xoá) file ảnh trong uploads/products không còn được dùng ở đâu:
 * không phải ảnh sản phẩm, ảnh đại diện, ảnh bộ sưu tập hay ảnh trong đơn hàng.
 * Bỏ qua file mới hơn 1 giờ (có thể đang được tạo / chưa kịp lưu).
 *
 *   yarn db:clean-uploads            # chỉ liệt kê (dry-run)
 *   yarn db:clean-uploads -- --apply # xoá thật
 */
import 'dotenv/config';

import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const DIR = join(process.cwd(), 'uploads', 'products');
const PREFIX = '/uploads/products/';
const MIN_AGE_MS = 60 * 60 * 1000;

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const [images, products, orderItems, collections] = await Promise.all([
      prisma.productImage.findMany({ select: { url: true } }),
      prisma.product.findMany({ select: { thumbnail: true } }),
      prisma.orderItem.findMany({ select: { image: true } }),
      prisma.collection.findMany({ select: { image: true } }),
    ]);
    const used = new Set<string>();
    for (const url of [
      ...images.map((r) => r.url),
      ...products.map((r) => r.thumbnail),
      ...orderItems.map((r) => r.image),
      ...collections.map((r) => r.image),
    ]) {
      if (url?.startsWith(PREFIX)) used.add(url.slice(PREFIX.length));
    }

    let count = 0;
    let bytes = 0;
    for (const name of readdirSync(DIR)) {
      if (used.has(name)) continue;
      const file = join(DIR, name);
      const stat = statSync(file);
      if (!stat.isFile() || Date.now() - stat.mtimeMs < MIN_AGE_MS) continue;
      count += 1;
      bytes += stat.size;
      console.log(`${apply ? 'xoá' : '[dry-run]'} ${name}`);
      if (apply) unlinkSync(file);
    }
    console.log(
      `${apply ? 'Đã xoá' : '[dry-run] Sẽ xoá'} ${count} file (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
