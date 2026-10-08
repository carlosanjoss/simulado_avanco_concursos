import { NextRequest, NextResponse } from 'next/server'
import { MONTHLY_QUIZ_LIMIT, getMonthlyUsage } from '@/lib/usage-limit'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Skip auth during build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({
      success: true,
      used: 0,
      remaining: MONTHLY_QUIZ_LIMIT,
      limit: MONTHLY_QUIZ_LIMIT,
      unlimited: false,
      monthKey: ''
    })
  }

  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const usage = await getMonthlyUsage(user.id, user.email)
  return NextResponse.json({ success: true, ...usage })
}
