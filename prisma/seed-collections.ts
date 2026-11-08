/**
 * Tạo các collection (Sân, Studio, Tập, ...) và gán sản phẩm đang có, KHÔNG seed lại
 * sản phẩm/biến thể:   yarn db:seed-collections
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { syncCollections } from './lib/collections';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const r = await syncCollections(prisma);
    console.log(
      `Collections: ${r.collections}, product links added: ${r.links}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
