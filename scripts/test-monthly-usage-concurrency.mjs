import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

for (const line of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const userId = `quota-test-${randomUUID()}`;
const monthKey = '2099-12';

try {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } });
  const reserve = () => prisma.$queryRawUnsafe(
    'INSERT INTO "MonthlyUsage" ("id", "userId", "monthKey", "count", "createdAt", "updatedAt") VALUES ($1, $2, $3, 1, NOW(), NOW()) ON CONFLICT ("userId", "monthKey") DO UPDATE SET "count" = "MonthlyUsage"."count" + 1, "updatedAt" = NOW() WHERE "MonthlyUsage"."count" < 2 RETURNING "count"',
    randomUUID(), userId, monthKey,
  );
  const results = await Promise.all(Array.from({ length: 8 }, reserve));
  const accepted = results.filter((rows) => rows.length === 1).length;
  const usage = await prisma.monthlyUsage.findUnique({ where: { userId_monthKey: { userId, monthKey } } });
  if (accepted !== 2 || usage?.count !== 2) throw new Error(`Falha: ${accepted} reservas aceitas; contador ${usage?.count}`);
  process.stdout.write(JSON.stringify({ accepted, rejected: results.length - accepted, storedCount: usage.count }) + '\n');
} finally {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}
