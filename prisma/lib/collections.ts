import type { PrismaClient } from '../../src/generated/prisma/client';

/** Bộ sưu tập hiển thị trên storefront. Ảnh tile nằm ở public của FE (/images/collections). */
export const COLLECTIONS: {
  slug: string;
  name: string;
  image: string;
  /** Quy tắc gán sản phẩm theo tên (chỉ dùng khi seed; về sau chỉnh trong trang admin). */
  match: RegExp;
}[] = [
  {
    slug: 'san',
    name: 'Sân',
    image: '/images/collections/san.webp',
    match: /skirt|smash|ace|court|love/i,
  },
  {
    slug: 'studio',
    name: 'Studio',
    image: '/images/collections/studio.webp',
    match: /leggings|serene|sculpt|femme|flow|poise|form/i,
  },
  {
    slug: 'tap',
    name: 'Tập',
    image: '/images/collections/tap.webp',
    match: /bra|track|contour|focus|rally|balance/i,
  },
  {
    slug: 'nghi-ngoi',
    name: 'Nghỉ ngơi',
    image: '/images/collections/nghi-ngoi.webp',
    match: /cover|off-duty|muse|fleur|lounge/i,
  },
  {
    slug: 'chay',
    name: 'Chạy',
    image: '/images/collections/chay.webp',
    match: /shorts|air|run|capri|tank/i,
  },
  {
    slug: 'phu-kien',
    name: 'Phụ kiện',
    image: '/images/collections/phu-kien.webp',
    match: /pad|phụ kiện|accessor/i,
  },
];

/**
 * Tạo/cập nhật collection và gán các sản phẩm đang có (theo tên). Chỉ THÊM liên kết còn
 * thiếu, không xoá liên kết đã có và không đụng tới biến thể/ảnh.
 */
export async function syncCollections(prisma: PrismaClient) {
  const idBySlug = new Map<string, string>();
  for (const [i, c] of COLLECTIONS.entries()) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: { name: c.name, image: c.image, sortOrder: i },
      create: { slug: c.slug, name: c.name, image: c.image, sortOrder: i },
    });
    idBySlug.set(c.slug, row.id);
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  const data = products.flatMap((p) =>
    COLLECTIONS.filter((c) => c.match.test(p.name)).map((c) => ({
      productId: p.id,
      collectionId: idBySlug.get(c.slug)!,
    })),
  );
  if (data.length > 0) {
    await prisma.productCollection.createMany({ data, skipDuplicates: true });
  }

  return { collections: COLLECTIONS.length, links: data.length };
}
