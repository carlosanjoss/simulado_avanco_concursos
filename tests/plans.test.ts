import { describe, expect, it } from 'vitest'
import { getPlanEntitlements } from '@/lib/plans'

describe('plan entitlements', () => {
  it('keeps the free plan within the commercial limits', () => {
    expect(getPlanEntitlements('FREE')).toMatchObject({
      planCode: 'FREE', monthlyQuizLimit: 2, maxQuestionsPerQuiz: 20,
      materialLimit: 3, maxMaterialsPerQuiz: 1, ocr: false,
      questionEditor: false, advancedReports: false, studyPlan: false,
      reviewNotebook: false, fullQuestionBank: false,
    })
  })

  it('unlocks the advanced product for Pro subscribers', () => {
    expect(getPlanEntitlements('PRO')).toMatchObject({
      planCode: 'PRO', monthlyQuizLimit: 30, maxQuestionsPerQuiz: 50,
      materialLimit: null, maxMaterialsPerQuiz: 5, ocr: true,
      questionEditor: true, advancedReports: true, studyPlan: true,
      reviewNotebook: true, fullQuestionBank: true,
    })
  })
})
