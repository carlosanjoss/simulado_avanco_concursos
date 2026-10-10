import { NextRequest, NextResponse } from 'next/server'
import { MONTHLY_QUIZ_LIMIT, getMonthlyUsage } from '@/lib/usage-limit'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'
import { getPlanEntitlements } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Skip auth during build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    const access = getPlanEntitlements('FREE')
    return NextResponse.json({
      success: true,
      used: 0,
      remaining: MONTHLY_QUIZ_LIMIT,
      limit: MONTHLY_QUIZ_LIMIT,
      unlimited: false,
      monthKey: '',
      access,
    })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const [usage, access] = await Promise.all([getMonthlyUsage(user.id, user.email), getUserPlanAccess(user)])
  return NextResponse.json({ success: true, ...usage, access })
}
