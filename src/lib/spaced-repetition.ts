export interface ReviewScheduleState {
  repetitions: number
  intervalDays: number
  easeFactor: number
}

export function nextReviewSchedule(state: ReviewScheduleState, quality: number, now = new Date()) {
  const normalizedQuality = Math.max(0, Math.min(5, Math.round(quality)))
  let repetitions = state.repetitions
  let intervalDays = state.intervalDays
  let easeFactor = state.easeFactor

  if (normalizedQuality < 3) {
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions += 1
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(intervalDays * easeFactor))
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - normalizedQuality) * (0.08 + (5 - normalizedQuality) * 0.02)))
  }

  const dueAt = new Date(now)
  dueAt.setUTCDate(dueAt.getUTCDate() + intervalDays)
  return { repetitions, intervalDays, easeFactor, dueAt, masteredAt: repetitions >= 5 ? now : null }
}
