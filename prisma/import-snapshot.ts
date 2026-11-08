/**
 * Nạp prisma/snapshot/catalog.json vào DB (giữ nguyên id nên quan hệ và URL ảnh khớp).
 *   yarn db:import            # chỉ thêm bản ghi chưa có (bỏ qua id đã tồn tại)
 *   yarn db:import --reset    # XOÁ toàn bộ catalog hiện có rồi nạp lại
 * Luôn đảm bảo có tài khoản admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import {
  reviveDates,
  SNAPSHOT_FILE,
  SNAPSHOT_TABLES,
  type Snapshot,
} from './lib/snapshot';

async function main() {
  const reset = process.argv.includes('--reset');
  const snapshot = JSON.parse(
    readFileSync(join(process.cwd(), SNAPSHOT_FILE), 'utf8'),
  ) as Snapshot;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await prisma.$transaction(
      async (tx) => {
        if (reset) {
          // Thứ tự ngược với lúc nhập; OrderItem.variantId tự về null (SetNull).
          for (const table of [...SNAPSHOT_TABLES].reverse()) {
            await (
              tx[table] as unknown as {
                deleteMany: () => Promise<unknown>;
              }
            ).deleteMany();
          }
        }
        for (const table of SNAPSHOT_TABLES) {
          const rows = (snapshot[table] ?? []).map(reviveDates);
          if (rows.length === 0) continue;
          const result = await (
            tx[table] as unknown as {
              createMany: (args: {
                data: unknown[];
                skipDuplicates: boolean;
              }) => Promise<{ count: number }>;
            }
          ).createMany({ data: rows, skipDuplicates: true });
          console.log(`${table}: +${result.count}/${rows.length}`);
        }
      },
      { timeout: 120_000 },
    );

    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    await prisma.user.upsert({
      where: { email },
      update: { role: UserRole.ADMIN, isActive: true },
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        displayName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    console.log(`Admin ready: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
