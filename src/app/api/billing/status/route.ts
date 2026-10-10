import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { isSubscriptionActive } from '@/lib/plans'
import { getUserPlanAccess } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  const active = isSubscriptionActive(subscription)
  const planCode = active ? subscription!.planCode : 'FREE'
  const access = await getUserPlanAccess(user)
  return NextResponse.json({
    planCode,
    active,
    status: subscription?.status || null,
    billingInterval: subscription?.billingInterval || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    monthlyQuizLimit: access.monthlyQuizLimit,
    access,
    management: 'NUVEMSHOP_SUPPORT',
  })
}
