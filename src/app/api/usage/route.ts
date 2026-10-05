import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MONTHLY_QUIZ_LIMIT, getMonthlyUsage } from '@/lib/usage-limit';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, email: true } });
  const usage = user
    ? await getMonthlyUsage(user.id, user.email)
    : { used: 0, remaining: MONTHLY_QUIZ_LIMIT, limit: MONTHLY_QUIZ_LIMIT, unlimited: false };
  return NextResponse.json({ success: true, ...usage });
}
