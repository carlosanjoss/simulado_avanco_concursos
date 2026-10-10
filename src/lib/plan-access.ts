import 'server-only'
import { prisma } from '@/lib/prisma'
import { getPlanEntitlements, isSubscriptionActive, type PlanEntitlements } from '@/lib/plans'

type PlanUser = { id: string; email?: string | null; isAdmin?: boolean }

export async function getUserPlanAccess(user: PlanUser): Promise<PlanEntitlements> {
  const devEmail = process.env.DEV_USER_EMAIL?.toLowerCase()
  if (user.isAdmin || (devEmail && user.email?.toLowerCase() === devEmail)) {
    return getPlanEntitlements('PRO')
  }
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  return getPlanEntitlements(isSubscriptionActive(subscription) ? subscription?.planCode : 'FREE')
}
