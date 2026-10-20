import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { isSubscriptionActive } from '@/lib/plans'
import { getUserPlanAccess } from '@/lib/plan-access'
import { fetchNuvemshopOrder, getNuvemshopOrderDisposition } from '@/lib/nuvemshop'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  let subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  let synchronized = false
  let syncWarning: string | null = null

  if (request.nextUrl.searchParams.get('sync') === '1' && subscription?.providerOrderId) {
    const staleBefore = new Date(Date.now() - 60_000)
    if (subscription.updatedAt < staleBefore) {
      try {
        const order = await fetchNuvemshopOrder(subscription.providerOrderId)
        const disposition = getNuvemshopOrderDisposition(order)
        if (disposition === 'REVOKED' || disposition === 'CANCELED') {
          const now = new Date()
          subscription = await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'CANCELED',
              canceledAt: now,
              currentPeriodEnd: disposition === 'REVOKED' ? now : subscription.currentPeriodEnd,
            },
          })
        }
        synchronized = true
      } catch (error) {
        syncWarning = error instanceof Error ? error.message : 'NUVEMSHOP_SYNC_FAILED'
      }
    }
  }

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
    synchronized,
    syncWarning,
  })
}
