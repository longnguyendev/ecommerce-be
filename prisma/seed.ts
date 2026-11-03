import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

import { PrismaClient } from '../src/generated/prisma/client';

const SALT_ROUNDS = 12;

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        displayName: 'Admin',
      },
    });

    console.log(`Seeded admin user: ${email}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.warn('Using the default password. Change it immediately.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
