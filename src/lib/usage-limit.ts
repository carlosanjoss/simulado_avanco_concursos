import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { FREE_MONTHLY_QUIZ_LIMIT, getPlanMonthlyQuizLimit, isSubscriptionActive } from '@/lib/plans';

export const MONTHLY_QUIZ_LIMIT = FREE_MONTHLY_QUIZ_LIMIT;
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Fortaleza';
const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL

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

async function getUserMonthlyLimit(userId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return getPlanMonthlyQuizLimit(isSubscriptionActive(subscription) ? subscription!.planCode : 'FREE');
}

function isDevUser(userId: string, email?: string): boolean {
  if (DEV_USER_EMAIL && email && email.toLowerCase() === DEV_USER_EMAIL.toLowerCase()) return true;
  return false;
}

export async function reserveMonthlyGeneration(userId: string, userEmail?: string): Promise<boolean> {
  if (isDevUser(userId, userEmail)) return true;
  const limit = await getUserMonthlyLimit(userId);
  const monthKey = getCurrentMonthKey();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "MonthlyUsage" ("id", "userId", "monthKey", "count", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${monthKey}, 1, NOW(), NOW())
    ON CONFLICT ("userId", "monthKey") DO UPDATE
    SET "count" = "MonthlyUsage"."count" + 1, "updatedAt" = NOW()
    WHERE "MonthlyUsage"."count" < ${limit}
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
  const limit = await getUserMonthlyLimit(userId);
  const used = usage?.count ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    unlimited: false,
    monthKey,
  };
}
