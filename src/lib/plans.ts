import 'server-only'

export const FREE_MONTHLY_QUIZ_LIMIT = 2
export const PRO_MONTHLY_QUIZ_LIMIT = Number(process.env.PRO_MONTHLY_QUIZ_LIMIT || 30)
export const FREE_MAX_QUESTIONS = 20
export const PRO_MAX_QUESTIONS = 50
export const FREE_MATERIAL_LIMIT = 3
export const MAX_MATERIALS_PER_QUIZ = 5

export type CommercialPlanCode = 'FREE' | 'PRO'
export type BillingInterval = 'MONTHLY' | 'ANNUAL'

export interface PlanEntitlements {
  planCode: CommercialPlanCode
  monthlyQuizLimit: number
  maxQuestionsPerQuiz: number
  materialLimit: number | null
  maxMaterialsPerQuiz: number
  ocr: boolean
  questionEditor: boolean
  advancedReports: boolean
  studyPlan: boolean
  reviewNotebook: boolean
  fullQuestionBank: boolean
}

export function getPlanMonthlyQuizLimit(planCode?: string | null): number {
  return planCode === 'PRO' ? PRO_MONTHLY_QUIZ_LIMIT : FREE_MONTHLY_QUIZ_LIMIT
}

export function getPlanEntitlements(planCode?: string | null): PlanEntitlements {
  const isPro = planCode === 'PRO'
  return {
    planCode: isPro ? 'PRO' : 'FREE',
    monthlyQuizLimit: getPlanMonthlyQuizLimit(planCode),
    maxQuestionsPerQuiz: isPro ? PRO_MAX_QUESTIONS : FREE_MAX_QUESTIONS,
    materialLimit: isPro ? null : FREE_MATERIAL_LIMIT,
    maxMaterialsPerQuiz: isPro ? MAX_MATERIALS_PER_QUIZ : 1,
    ocr: isPro,
    questionEditor: isPro,
    advancedReports: isPro,
    studyPlan: isPro,
    reviewNotebook: isPro,
    fullQuestionBank: isPro,
  }
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
