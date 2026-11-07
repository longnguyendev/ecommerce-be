/**
 * Bỏ kiểu đặt tên có chứa màu trong tên sản phẩm: gộp các sản phẩm bị tách theo màu
 * thành 1 sản phẩm có nhiều biến thể, và tách màu khỏi tên của sản phẩm đứng riêng.
 *
 *   yarn db:merge-variants                       # chạy thử, chỉ in báo cáo (KHÔNG ghi DB)
 *   yarn db:merge-variants --apply               # thực hiện
 *   yarn db:merge-variants --apply --only=fleur  # chỉ xử lý nhóm/sản phẩm có tên chứa "fleur"
 *   yarn db:merge-variants --apply --rename-slug # đổi cả slug theo tên mới
 *   yarn db:merge-variants --all-suffixes        # coi mọi phần sau " - " là màu (trừ có số / Freesize)
 *
 * 1) Nhóm (vd "Fleur Bra - Đen", "Fleur Bra - Nâu", "Fleur Bra - Vàng Bơ"):
 *    - Sản phẩm tạo sớm nhất làm sản phẩm chính, đổi tên thành "Fleur Bra".
 *    - Biến thể của các sản phẩm cũ được CHUYỂN sang sản phẩm chính (đơn hàng cũ vẫn trỏ
 *      đúng) và gán thuộc tính "Màu sắc" theo màu trong tên.
 *    - Ảnh chuyển sang sản phẩm chính, gắn vào biến thể tương ứng.
 *    - Sản phẩm cũ bị xoá mềm.
 * 2) Sản phẩm đứng riêng ("Femme Bra - Đen"): đổi tên thành "Femme Bra", gán Màu sắc = Đen.
 *    Chỉ làm khi phần sau " - " là một màu đã thấy trong các nhóm ở mục 1 (tránh nhầm với
 *    "1 cặp", "Freesize"...). Các trường hợp còn lại được liệt kê để xử lý tay.
 *
 * Về biến thể của mỗi sản phẩm cũ: các biến thể chỉ khác nhau ở "Màu sắc" (do seed cũ sinh
 * theo bảng màu) bị coi là thừa, chỉ giữ biến thể đầu tiên (các còn lại xoá mềm). Biến thể
 * khác nhau ở thuộc tính khác (vd Size) được giữ nguyên, và đều được gán màu của sản phẩm.
 * Mỗi nhóm / sản phẩm chạy trong 1 transaction.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import {
  groupProducts,
  MergeGroup,
  parseProductName,
} from './lib/group-products';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RENAME_SLUG = args.includes('--rename-slug');
const ALL_SUFFIXES = args.includes('--all-suffixes');
const ONLY = args
  .find((a) => a.startsWith('--only='))
  ?.slice('--only='.length)
  .toLowerCase();

const COLOR_ATTRIBUTE = 'Màu sắc';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface Row {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  createdAt: Date;
  variantCount: number;
}

/**
 * Chuyển biến thể của `memberId` sang `targetProductId` và gán màu.
 * Trả về số biến thể đã giữ / đã xoá mềm và id biến thể đầu tiên.
 */
async function moveVariants(
  tx: Prisma.TransactionClient,
  memberId: string,
  targetProductId: string,
  colorAttributeId: string,
  colorValueId: string,
): Promise<{ kept: number; removed: number; firstVariantId: string }> {
  const variants = await tx.productVariant.findMany({
    where: { productId: memberId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sku: true,
      attributes: { select: { attributeId: true, attributeValueId: true } },
    },
  });

  const seen = new Set<string>();
  let kept = 0;
  let removed = 0;
  let firstVariantId = '';

  for (const variant of variants) {
    // Khoá = các thuộc tính KHÁC màu (vd Size). Cùng khoá = chỉ khác màu = biến thể thừa.
    const key = variant.attributes
      .filter((a) => a.attributeId !== colorAttributeId)
      .map((a) => `${a.attributeId}:${a.attributeValueId}`)
      .sort()
      .join('|');

    if (seen.has(key)) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          deletedAt: new Date(),
          sku: `${variant.sku}__del_${Date.now()}`,
        },
      });
      removed += 1;
      continue;
    }
    seen.add(key);

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { productId: targetProductId },
    });
    await tx.variantAttributeValue.deleteMany({
      where: { variantId: variant.id, attributeId: colorAttributeId },
    });
    await tx.variantAttributeValue.create({
      data: {
        variantId: variant.id,
        attributeId: colorAttributeId,
        attributeValueId: colorValueId,
      },
    });
    if (!firstVariantId) firstVariantId = variant.id;
    kept += 1;
  }

  return { kept, removed, firstVariantId };
}

async function upsertColor(
  tx: Prisma.TransactionClient,
  colorAttributeId: string,
  value: string,
): Promise<string> {
  const row = await tx.attributeValue.upsert({
    where: { attributeId_value: { attributeId: colorAttributeId, value } },
    update: {},
    create: { attributeId: colorAttributeId, value },
    select: { id: true },
  });
  return row.id;
}

async function renameProduct(
  tx: Prisma.TransactionClient,
  id: string,
  name: string,
): Promise<void> {
  const data: Prisma.ProductUpdateInput = { name };
  if (RENAME_SLUG) {
    const slug = slugify(name);
    const clash = await tx.product.findFirst({
      where: { slug, id: { not: id } },
      select: { id: true },
    });
    if (slug && !clash) data.slug = slug;
  }
  await tx.product.update({ where: { id }, data });
}

async function mergeGroup(
  tx: Prisma.TransactionClient,
  group: MergeGroup<Row>,
  colorAttributeId: string,
): Promise<{
  moved: number;
  removedVariants: number;
  removedProducts: number;
}> {
  const primary = group.members[0].product;
  let moved = 0;
  let removedVariants = 0;
  let removedProducts = 0;

  for (const [index, member] of group.members.entries()) {
    const colorValueId = await upsertColor(tx, colorAttributeId, member.color);
    const result = await moveVariants(
      tx,
      member.product.id,
      primary.id,
      colorAttributeId,
      colorValueId,
    );
    moved += result.kept;
    removedVariants += result.removed;

    if (index > 0) {
      await tx.productImage.updateMany({
        where: { productId: member.product.id },
        data: {
          productId: primary.id,
          variantId: result.firstVariantId,
          isPrimary: false,
        },
      });
      await tx.product.update({
        where: { id: member.product.id },
        data: { deletedAt: new Date() },
      });
      removedProducts += 1;
    }
  }

  await renameProduct(tx, primary.id, group.base);
  return { moved, removedVariants, removedProducts };
}

async function cleanSingle(
  tx: Prisma.TransactionClient,
  row: Row,
  base: string,
  color: string,
  colorAttributeId: string,
): Promise<number> {
  const colorValueId = await upsertColor(tx, colorAttributeId, color);
  const result = await moveVariants(
    tx,
    row.id,
    row.id,
    colorAttributeId,
    colorValueId,
  );
  await renameProduct(tx, row.id, base);
  return result.removed;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        createdAt: true,
        _count: { select: { variants: { where: { deletedAt: null } } } },
      },
    });

    const rows: Row[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
      variantCount: p._count.variants,
    }));

    const allGroups = groupProducts(rows);
    const inAnyGroup = new Set(
      allGroups.flatMap((g) => g.members.map((m) => m.product.id)),
    );
    // Từ vựng màu = các màu đã thấy trong các nhóm gộp được.
    const colorVocab = new Set(
      allGroups.flatMap((g) => g.members.map((m) => m.color.toLowerCase())),
    );

    const matches = (text: string) =>
      !ONLY || text.toLowerCase().includes(ONLY);

    const plan: MergeGroup<Row>[] = [];
    const skipped: string[] = [];

    for (const group of allGroups.filter((g) => matches(g.base))) {
      if (group.duplicateColors.length > 0) {
        skipped.push(
          `${group.base}: trùng màu (${group.duplicateColors.join(', ')}) - xử lý tay`,
        );
        continue;
      }
      const members = group.members.filter((m) => m.product.variantCount > 0);
      if (members.length < 2) {
        skipped.push(`${group.base}: không đủ sản phẩm có biến thể`);
        continue;
      }
      plan.push({ ...group, members });
    }

    const singles: { row: Row; base: string; color: string }[] = [];
    const unsure: string[] = [];
    for (const row of rows) {
      if (inAnyGroup.has(row.id) || !matches(row.name)) continue;
      const { base, color } = parseProductName(row.name);
      if (!color) continue;
      const looksLikeColor =
        colorVocab.has(color.toLowerCase()) ||
        (ALL_SUFFIXES && !/\d|freesize/i.test(color));
      if (looksLikeColor && row.variantCount > 0) {
        singles.push({ row, base, color });
      } else {
        unsure.push(`${row.name}  (phần sau " - " = "${color}")`);
      }
    }

    console.log(`\nTổng sản phẩm đang hoạt động: ${rows.length}`);
    console.log(`\n== Nhóm sẽ gộp: ${plan.length} ==`);
    for (const g of plan) {
      console.log(
        `• ${g.base}  <=  ${g.members
          .map((m) => `${m.color} [${m.product.name}]`)
          .join('  |  ')}`,
      );
    }
    console.log(
      `\n== Sản phẩm đơn lẻ sẽ bỏ màu khỏi tên: ${singles.length} ==`,
    );
    for (const s of singles) {
      console.log(`• ${s.row.name}  ->  ${s.base}  (Màu sắc: ${s.color})`);
    }
    if (skipped.length > 0) {
      console.log('\nBỏ qua nhóm:');
      for (const s of skipped) console.log(`  - ${s}`);
    }
    if (unsure.length > 0) {
      console.log('\nGiữ nguyên tên (không chắc phần sau " - " là màu):');
      for (const s of unsure) console.log(`  - ${s}`);
    }

    const before = plan.reduce((n, g) => n + g.members.length, 0);
    console.log(
      `\nGộp: ${before} sản phẩm -> ${plan.length} sản phẩm (giảm ${before - plan.length}).`,
    );

    if (!APPLY) {
      console.log(
        '\nĐây là chạy thử, chưa ghi gì vào DB. Thêm --apply để thực hiện.',
      );
      return;
    }

    const colorAttribute = await prisma.attribute.upsert({
      where: { name: COLOR_ATTRIBUTE },
      update: {},
      create: { name: COLOR_ATTRIBUTE },
      select: { id: true },
    });

    let moved = 0;
    let removedVariants = 0;
    let removedProducts = 0;
    for (const group of plan) {
      const result = await prisma.$transaction(
        (tx) => mergeGroup(tx, group, colorAttribute.id),
        { timeout: 120_000 },
      );
      moved += result.moved;
      removedVariants += result.removedVariants;
      removedProducts += result.removedProducts;
      console.log(`✓ ${group.base}`);
    }

    for (const s of singles) {
      removedVariants += await prisma.$transaction(
        (tx) => cleanSingle(tx, s.row, s.base, s.color, colorAttribute.id),
        { timeout: 60_000 },
      );
      console.log(`✓ ${s.row.name} -> ${s.base}`);
    }

    console.log(
      `\nXong: ${plan.length} sản phẩm gộp, ${singles.length} sản phẩm đơn lẻ đổi tên, ` +
        `${moved} biến thể được chuyển, ${removedVariants} biến thể thừa xoá mềm, ` +
        `${removedProducts} sản phẩm cũ xoá mềm.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
