import 'server-only'

export const FREE_MONTHLY_QUIZ_LIMIT = 2
export const PRO_MONTHLY_QUIZ_LIMIT = Number(process.env.PRO_MONTHLY_QUIZ_LIMIT || 30)

export type CommercialPlanCode = 'FREE' | 'PRO'
export type BillingInterval = 'MONTHLY' | 'ANNUAL'

export function getPlanMonthlyQuizLimit(planCode?: string | null): number {
  return planCode === 'PRO' ? PRO_MONTHLY_QUIZ_LIMIT : FREE_MONTHLY_QUIZ_LIMIT
}

export function isSubscriptionActive(subscription?: { status: string; currentPeriodEnd: Date | null } | null, now = new Date()): boolean {
  if (!subscription || !['ACTIVE', 'CANCELED'].includes(subscription.status)) return false
  if (subscription.status === 'CANCELED' && !subscription.currentPeriodEnd) return false
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > now
}

export function getPublicPricing() {
  return {
    proMonthly: {
      label: process.env.NEXT_PUBLIC_PRO_MONTHLY_PRICE || 'A definir',
      url: process.env.NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL || '',
    },
    proAnnual: {
      label: process.env.NEXT_PUBLIC_PRO_ANNUAL_PRICE || 'A definir',
      url: process.env.NEXT_PUBLIC_NUVEMSHOP_PRO_ANNUAL_URL || '',
    },
    proLimit: PRO_MONTHLY_QUIZ_LIMIT,
  }
}
