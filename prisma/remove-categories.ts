/**
 * Bỏ các danh mục không phù hợp (mặc định mọi danh mục có tên chứa "Điện thoại" hoặc "Thiết bị"): chuyển sản phẩm của
 * chúng sang danh mục phù hợp đã có (theo tên sản phẩm: Bra / Leggings / Chân váy / Set /
 * Áo / Khác) rồi xoá các danh mục đó.
 *
 *   yarn db:remove-categories                          # chạy thử, chỉ in báo cáo
 *   yarn db:remove-categories --apply                  # thực hiện
 *   yarn db:remove-categories --names="Điện thoại,Thiết bị" --apply   # từ khoá, khớp theo tên chứa từ khoá
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const namesArg = args.find((a) => a.startsWith('--names='));
const NAMES = (
  namesArg ? namesArg.slice('--names='.length) : 'Điện thoại,Thiết bị'
)
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

const KIND_RULES: [RegExp, string][] = [
  [/bra/i, 'bra'],
  [/leggings/i, 'leggings'],
  [/váy|skirt/i, 'chan-vay'],
  [/set/i, 'set'],
  [/áo|top|jacket|cover/i, 'ao'],
];

function targetSlug(productName: string): string {
  for (const [re, slug] of KIND_RULES) if (re.test(productName)) return slug;
  return 'khac';
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const all = await prisma.category.findMany({ include: { children: true } });
    const removing = all.filter((c) =>
      NAMES.some((n) => c.name.toLowerCase().includes(n.toLowerCase())),
    );
    if (removing.length === 0) {
      console.log(`Không có danh mục nào có tên chứa: ${NAMES.join(', ')}`);
      return;
    }
    const removingIds = new Set(removing.map((c) => c.id));
    const keep = all.filter((c) => !removingIds.has(c.id));
    const bySlug = new Map(keep.map((c) => [c.slug, c]));
    const fallback = bySlug.get('khac') ?? keep[0];
    if (!fallback)
      throw new Error('Không còn danh mục nào để chuyển sản phẩm sang');

    console.log(
      APPLY ? '== THỰC HIỆN ==' : '== CHẠY THỬ (thêm --apply để ghi DB) ==',
    );

    for (const cat of removing) {
      if (cat.children.length > 0) {
        console.log(
          `! Bỏ qua "${cat.name}": còn ${cat.children.length} danh mục con, xử lý tay.`,
        );
        continue;
      }
      // Gồm cả sản phẩm đã xoá mềm vì chúng vẫn giữ khoá ngoại tới danh mục.
      const products = await prisma.product.findMany({
        where: { categoryId: cat.id },
        select: { id: true, name: true, deletedAt: true },
      });
      console.log(`\n"${cat.name}": ${products.length} sản phẩm`);

      const moves = products.map((p) => {
        const target = bySlug.get(targetSlug(p.name)) ?? fallback;
        console.log(
          `  ${p.name}${p.deletedAt ? ' (đã xoá mềm)' : ''} -> ${target.name}`,
        );
        return { id: p.id, categoryId: target.id };
      });

      if (!APPLY) continue;
      await prisma.$transaction([
        ...moves.map((m) =>
          prisma.product.update({
            where: { id: m.id },
            data: { categoryId: m.categoryId },
          }),
        ),
        prisma.category.delete({ where: { id: cat.id } }),
      ]);
      console.log(
        `  ✔ đã chuyển ${moves.length} sản phẩm và xoá danh mục "${cat.name}"`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
