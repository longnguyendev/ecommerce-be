import 'dotenv/config';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

import {
  PrismaClient,
  ProductStatus,
  UserRole,
} from '../src/generated/prisma/client';

const SALT_ROUNDS = 12;

interface CatalogProduct {
  slug: string;
  name: string;
  price: number;
  compareAt: number | null;
  images: string[];
  colors: string[];
}

interface Catalog {
  products: CatalogProduct[];
}

function loadCatalog(): Catalog {
  const candidates = [
    join(process.cwd(), 'prisma/catalog.json'),
    join(process.cwd(), '../app/data/catalog.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8')) as Catalog;
    }
  }
  throw new Error('catalog.json not found (expected prisma/catalog.json)');
}

/** Ảnh catalog ghi "/images/products/x.jpg"; file thực nằm ở ./uploads/products (serve tại /uploads/products/). */
function uploadUrl(path: string): string {
  return path.replace(/^\/images\/products\//, '/uploads/products/');
}

function kindOf(name: string): string {
  const rules: [RegExp, string][] = [
    [/bra/i, 'Bra'],
    [/leggings/i, 'Leggings'],
    [/váy|skirt/i, 'Chân váy'],
    [/set/i, 'Set'],
    [/áo|top|jacket|cover/i, 'Áo'],
  ];
  for (const [re, kind] of rules) if (re.test(name)) return kind;
  return 'Khác';
}

const KIND_SLUG: Record<string, string> = {
  Bra: 'bra',
  Leggings: 'leggings',
  'Chân váy': 'chan-vay',
  Set: 'set',
  Áo: 'ao',
  Khác: 'khac',
};

const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Đen', hex: '#181815' },
  { name: 'Trắng', hex: '#F2F1EC' },
  { name: 'Be', hex: '#D8C3A5' },
  { name: 'Xanh dương', hex: '#3A6BC4' },
  { name: 'Nâu', hex: '#6B4A32' },
  { name: 'Xám', hex: '#9A9A92' },
  { name: 'Xanh lá', hex: '#5B7F5B' },
  { name: 'Cam', hex: '#DE8A3C' },
  { name: 'Hồng', hex: '#E0A0B4' },
  { name: 'Tím', hex: '#7A5BA8' },
  { name: 'Đỏ', hex: '#BF3B30' },
  { name: 'Vàng', hex: '#E3C24B' },
  { name: 'Kem', hex: '#C8A97E' },
];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function nearestColorName(hex: string): string {
  const c = parseHex(hex);
  if (!c) return '';
  let best = COLOR_PALETTE[0];
  let bestD = Infinity;
  for (const p of COLOR_PALETTE) {
    const q = parseHex(p.hex)!;
    const d =
      (c.r - q.r) ** 2 * 0.3 +
      (c.g - q.g) ** 2 * 0.59 +
      (c.b - q.b) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.name;
}

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. Admin account
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email },
      update: { role: UserRole.ADMIN, isActive: true },
      create: {
        email,
        passwordHash,
        displayName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    console.log(`Seeded admin user: ${email} (role ADMIN)`);

    const catalog = loadCatalog();
    console.log(`Loaded catalog: ${catalog.products.length} products`);

    // 2. Categories (by product kind)
    const kinds = [...new Set(catalog.products.map((p) => kindOf(p.name)))];
    const categoryByKind = new Map<string, string>();
    for (const kind of kinds) {
      const cat = await prisma.category.upsert({
        where: { slug: KIND_SLUG[kind] ?? `cat-${kind.length}` },
        update: { name: kind },
        create: {
          name: kind,
          slug: KIND_SLUG[kind] ?? `cat-${kind.length}`,
        },
      });
      categoryByKind.set(kind, cat.id);
    }
    console.log(`Seeded ${kinds.length} categories: ${kinds.join(', ')}`);

    // 3. Attributes + values (for variant size/color)
    // Clean up junk attributes left by earlier seed versions (name with a random suffix).
    const junkAttributes = await prisma.attribute.findMany({
      where: {
        OR: [
          { name: { startsWith: 'Màu sắc ' } },
          { name: { startsWith: 'Size ' } },
        ],
      },
      select: { id: true },
    });
    for (const junk of junkAttributes) {
      await prisma.variantAttributeValue.deleteMany({
        where: { attributeId: junk.id },
      });
      await prisma.attributeValue.deleteMany({
        where: { attributeId: junk.id },
      });
      await prisma.attribute.delete({ where: { id: junk.id } });
    }

    const SIZES = ['S', 'M', 'L', 'XL'];
    const COLORS = [
      'Đen',
      'Trắng',
      'Be',
      'Xanh dương',
      'Nâu',
      'Xám',
      'Xanh lá',
      'Cam',
      'Hồng',
      'Tím',
      'Đỏ',
      'Vàng',
      'Kem',
    ];

    async function upsertAttribute(name: string, values: string[]) {
      const attr = await prisma.attribute.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      for (const value of values) {
        await prisma.attributeValue.upsert({
          where: { attributeId_value: { attributeId: attr.id, value } },
          update: {},
          create: { attributeId: attr.id, value },
        });
      }
      return attr;
    }

    await upsertAttribute('Size', SIZES);
    const colorAttribute = await upsertAttribute('Màu sắc', COLORS);
    console.log('Seeded attributes: Màu sắc (13), Size (4)');

    const colorValues = await prisma.attributeValue.findMany({
      where: { attributeId: colorAttribute.id },
      select: { id: true, value: true },
    });
    const colorValueIdByName = new Map(colorValues.map((v) => [v.value, v.id]));

    // 4. Products + default variant + images
    let created = 0;
    for (const p of catalog.products) {
      const categoryId = categoryByKind.get(kindOf(p.name));
      if (!categoryId) continue;

      const images = p.images.map(uploadUrl);
      const thumbnail = images[0] ?? null;

      const product = await prisma.product.upsert({
        where: { slug: p.slug },
        update: {
          categoryId,
          name: p.name,
          thumbnail,
          status: ProductStatus.ACTIVE,
        },
        create: {
          categoryId,
          name: p.name,
          slug: p.slug,
          description: `${p.name} — thiết kế bởi EQL Apparel.`,
          thumbnail,
          status: ProductStatus.ACTIVE,
        },
      });

      // Reset variants for this product (idempotent re-seed)
      await prisma.productVariant.deleteMany({
        where: { productId: product.id },
      });

      const colorNames = [
        ...new Set((p.colors ?? []).map(nearestColorName).filter(Boolean)),
      ];
      const names = colorNames.length > 0 ? colorNames : [''];

      for (let i = 0; i < names.length; i += 1) {
        const colorName = names[i];
        const sku = i === 0 ? p.slug : `${p.slug}-${i}`;
        const colorValueId = colorName
          ? colorValueIdByName.get(colorName)
          : undefined;

        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku,
            price: p.price,
            compareAtPrice: p.compareAt,
            stockQuantity: 100,
            isActive: true,
            attributes: colorValueId
              ? {
                  create: [
                    {
                      attributeId: colorAttribute.id,
                      attributeValueId: colorValueId,
                    },
                  ],
                }
              : undefined,
          },
        });
      }

      const imageCount = await prisma.productImage.count({
        where: { productId: product.id },
      });
      if (imageCount === 0) {
        await prisma.productImage.createMany({
          data: images.map((url, i) => ({
            productId: product.id,
            url,
            alt: `${p.name} — view ${i + 1}`,
            sortOrder: i,
            isPrimary: i === 0,
          })),
        });
      }

      created += 1;
    }

    console.log(`Seeded ${created} products (with variant + images)`);
    console.log(`Total products in DB: ${await prisma.product.count()}`);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
