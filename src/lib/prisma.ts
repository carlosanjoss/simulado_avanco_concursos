import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && process.env.USE_SUPABASE_POOLER === 'true') {
  try {
    const url = new URL(databaseUrl);
    url.port = '6543';
    databaseUrl = url.toString();
  } catch {
    // If URL parsing fails, keep original
  }
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
