export interface ReviewScheduleState {
  repetitions: number
  intervalDays: number
  easeFactor: number
  lapses?: number
}

export type ReviewErrorType = 'CONTENT' | 'ATTENTION' | 'DOUBT'

export function nextReviewSchedule(state: ReviewScheduleState, quality: number, now = new Date(), errorType: ReviewErrorType = 'CONTENT') {
  const adjustment = errorType === 'CONTENT' ? -1 : errorType === 'ATTENTION' ? 1 : 0
  const normalizedQuality = Math.max(0, Math.min(5, Math.round(quality + adjustment)))
  let repetitions = state.repetitions
  let intervalDays = state.intervalDays
  let easeFactor = state.easeFactor
  let lapses = state.lapses || 0

  if (normalizedQuality < 3) {
    repetitions = 0
    intervalDays = 1
    lapses += 1
  } else {
    repetitions += 1
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(intervalDays * easeFactor))
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - normalizedQuality) * (0.08 + (5 - normalizedQuality) * 0.02)))
  }

  const dueAt = new Date(now)
  dueAt.setUTCDate(dueAt.getUTCDate() + intervalDays)
  return { repetitions, intervalDays, easeFactor, lapses, dueAt, masteredAt: repetitions >= 5 ? now : null }
}

export function estimateRetention(state: ReviewScheduleState & { dueAt: Date; lastReviewedAt?: Date | null }, now = new Date()): number {
  const baseDate = state.lastReviewedAt || new Date(state.dueAt.getTime() - Math.max(1, state.intervalDays) * 86_400_000)
  const elapsedDays = Math.max(0, (now.getTime() - baseDate.getTime()) / 86_400_000)
  const stability = Math.max(1, state.intervalDays * Math.max(1.3, state.easeFactor))
  const retention = Math.exp(-elapsedDays / stability)
  return Math.max(5, Math.min(99, Math.round(retention * 100)))
}
