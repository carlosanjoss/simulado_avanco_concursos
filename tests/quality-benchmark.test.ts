import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { extractTextFromPDF } from '@/lib/pdf-utils'
import { findDuplicateQuestionIds, getQuestionGroundingIssues } from '@/lib/question-generation'
import {
  QUALITY_BENCHMARK_EXPECTED_CONCEPTS,
  QUALITY_BENCHMARK_PAGES,
  QUALITY_BENCHMARK_QUESTIONS,
} from './fixtures/quality-benchmark'

describe('offline question quality benchmark', () => {
  it('extracts every expected concept from a deterministic reference PDF', async () => {
    const document = await PDFDocument.create()
    const font = await document.embedFont(StandardFonts.Helvetica)
    for (const text of QUALITY_BENCHMARK_PAGES) {
      const page = document.addPage([595, 842])
      page.drawText(text, { x: 48, y: 780, size: 11, font, maxWidth: 500 })
    }
    const extracted = await extractTextFromPDF(Buffer.from(await document.save()))
    const normalized = extracted.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    for (const concept of QUALITY_BENCHMARK_EXPECTED_CONCEPTS) {
      expect(normalized).toContain(concept.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    }
  })

  it('keeps reference questions unique and grounded without calling an AI provider', () => {
    expect(findDuplicateQuestionIds(QUALITY_BENCHMARK_QUESTIONS)).toEqual([])
    for (const question of QUALITY_BENCHMARK_QUESTIONS) {
      expect(getQuestionGroundingIssues(question), question.tema).toEqual([])
    }
  })
})
