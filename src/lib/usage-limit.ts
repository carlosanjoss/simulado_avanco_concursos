import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const MONTHLY_QUIZ_LIMIT = 2;
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Fortaleza';
const DEV_USER_ID = process.env.CLERK_DEV_USER_ID;
const DEV_USER_EMAIL = process.env.CLERK_DEV_USER_EMAIL;

export function getCurrentMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function canGenerateThisMonth(currentCount: number): boolean {
  return Number.isInteger(currentCount) && currentCount >= 0 && currentCount < MONTHLY_QUIZ_LIMIT;
}

function isDevUser(userId: string, email?: string): boolean {
  if (DEV_USER_ID && userId === DEV_USER_ID) return true;
  if (DEV_USER_EMAIL && email && email.toLowerCase() === DEV_USER_EMAIL.toLowerCase()) return true;
  return false;
}

export async function reserveMonthlyGeneration(userId: string, userEmail?: string): Promise<boolean> {
  if (isDevUser(userId, userEmail)) return true;
  const monthKey = getCurrentMonthKey();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "MonthlyUsage" ("id", "userId", "monthKey", "count", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${monthKey}, 1, NOW(), NOW())
    ON CONFLICT ("userId", "monthKey") DO UPDATE
    SET "count" = "MonthlyUsage"."count" + 1, "updatedAt" = NOW()
    WHERE "MonthlyUsage"."count" < ${MONTHLY_QUIZ_LIMIT}
    RETURNING "count"
  `);
  return rows.length === 1;
}

export async function releaseMonthlyGeneration(userId: string, userEmail?: string): Promise<void> {
  if (isDevUser(userId, userEmail)) return;
  const monthKey = getCurrentMonthKey();
  await prisma.monthlyUsage.updateMany({
    where: { userId, monthKey, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

export async function getMonthlyUsage(userId: string, userEmail?: string) {
  const monthKey = getCurrentMonthKey();
  if (isDevUser(userId, userEmail)) {
    return { used: 0, limit: null, remaining: null, unlimited: true, monthKey };
  }
  const usage = await prisma.monthlyUsage.findUnique({
    where: { userId_monthKey: { userId, monthKey } },
  });
  const used = usage?.count ?? 0;
  return {
    used,
    limit: MONTHLY_QUIZ_LIMIT,
    remaining: Math.max(0, MONTHLY_QUIZ_LIMIT - used),
    unlimited: false,
    monthKey,
  };
}
