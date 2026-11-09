/**
 * Dữ liệu seed cũ để toàn bộ ảnh của sản phẩm là "ảnh chung" (thực chất là gallery của màu đầu
 * tiên), còn các màu khác có ảnh riêng. Script này gán các ảnh chung đó cho màu đầu tiên.
 *
 * Chỉ áp dụng cho sản phẩm thoả CẢ BA điều kiện:
 *   1. có từ 2 màu trở lên (giá trị thuộc tính "Màu sắc" của các biến thể);
 *   2. màu đầu tiên (theo biến thể tạo sớm nhất) chưa có ảnh riêng;
 *   3. có ít nhất một màu khác đã có ảnh riêng.
 *
 *   yarn db:assign-shared -- --dry-run   # chỉ in ra, không ghi
 *   yarn db:assign-shared                # áp dụng (chạy lại an toàn: sản phẩm đã xử lý không khớp nữa)
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const COLOR_ATTRIBUTE = 'Màu sắc';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        images: { select: { id: true, attributeValueId: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            attributes: {
              select: {
                attribute: { select: { name: true } },
                attributeValueId: true,
              },
            },
          },
        },
      },
    });

    let changedProducts = 0;
    let movedImages = 0;
    for (const p of products) {
      // Màu theo thứ tự xuất hiện (biến thể tạo sớm nhất trước).
      const colorIds: string[] = [];
      for (const v of p.variants) {
        const color = v.attributes.find(
          (a) => a.attribute.name === COLOR_ATTRIBUTE,
        );
        if (color && !colorIds.includes(color.attributeValueId)) {
          colorIds.push(color.attributeValueId);
        }
      }
      if (colorIds.length < 2) continue;

      const [firstColor, ...otherColors] = colorIds;
      const shared = p.images.filter((i) => !i.attributeValueId);
      if (shared.length === 0) continue;
      const firstHasOwn = p.images.some(
        (i) => i.attributeValueId === firstColor,
      );
      const otherHasOwn = p.images.some(
        (i) => i.attributeValueId && otherColors.includes(i.attributeValueId),
      );
      if (firstHasOwn || !otherHasOwn) continue;

      console.log(
        `${dryRun ? '[dry-run] ' : ''}${p.name}: ${shared.length} ảnh chung -> màu đầu tiên`,
      );
      if (!dryRun) {
        await prisma.productImage.updateMany({
          where: { id: { in: shared.map((i) => i.id) } },
          data: { attributeValueId: firstColor },
        });
      }
      changedProducts += 1;
      movedImages += shared.length;
    }
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${changedProducts} sản phẩm, ${movedImages} ảnh`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
