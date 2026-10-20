import { describe, expect, it } from 'vitest'
import { averageOcrConfidence, normalizeOcrConfidence, shouldUseOcrForPage } from '@/lib/ocr'

describe('OCR page detection and confidence', () => {
  it('detects fully scanned pages without a useful text layer', () => {
    expect(shouldUseOcrForPage({ text: '1', textItems: 1 })).toEqual({ required: true, reason: 'empty' })
  })

  it('detects partially scanned pages that only expose a short header', () => {
    const result = shouldUseOcrForPage({ text: 'CAPÍTULO 2 — DIREITO CONSTITUCIONAL. Documento digitalizado abaixo desta linha.', textItems: 5 })
    expect(result).toEqual({ required: true, reason: 'partial' })
  })

  it('does not OCR a page with a substantial selectable text layer', () => {
    const text = 'Conteúdo textual selecionável com conceitos e explicações completas. '.repeat(12)
    expect(shouldUseOcrForPage({ text, textItems: 60 }).required).toBe(false)
  })

  it('normalizes confidence and calculates its average', () => {
    expect(normalizeOcrConfidence(104.8)).toBe(100)
    expect(normalizeOcrConfidence(-2)).toBe(0)
    expect(averageOcrConfidence([80.4, 60.4])).toBe(70)
    expect(averageOcrConfidence([])).toBeNull()
  })
})
