import { describe, expect, it } from 'vitest'
import { hasLicensedOfficialSource, normalizeQuestionTags } from '@/lib/question-bank'

describe('question bank metadata', () => {
  it('normalizes and removes duplicate tags without changing their readable form', () => {
    expect(normalizeQuestionTags([' Direito ', '#direito', 'Constitucional'])).toEqual(['Direito', 'Constitucional'])
  })

  it('requires source and permission for official questions', () => {
    expect(hasLicensedOfficialSource({ sourceType: 'OFFICIAL_LICENSED', sourceName: 'Banca X', licenseReference: '' })).toBe(false)
    expect(hasLicensedOfficialSource({ sourceType: 'OFFICIAL_LICENSED', sourceName: 'Banca X', licenseReference: 'Contrato 123' })).toBe(true)
  })

  it('does not require a license for user-generated questions', () => {
    expect(hasLicensedOfficialSource({ sourceType: 'USER_GENERATED' })).toBe(true)
  })
})
