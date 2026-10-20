export const OCR_LANGUAGES = ['por', 'eng', 'spa', 'fra'] as const
export type OcrLanguage = typeof OCR_LANGUAGES[number]
export const DEFAULT_MAX_OCR_PAGES = 40

export function shouldUseOcrForPage(input: { text: string; textItems: number }): { required: boolean; reason: 'empty' | 'partial' | null } {
  const normalized = input.text.replace(/\s+/g, ' ').trim()
  const letters = normalized.match(/\p{L}/gu)?.length || 0
  if (letters < 40) return { required: true, reason: 'empty' }
  if (letters < 220 && input.textItems < 18) return { required: true, reason: 'partial' }
  return { required: false, reason: null }
}

export function normalizeOcrConfidence(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

export function averageOcrConfidence(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + normalizeOcrConfidence(value), 0) / values.length) : null
}
