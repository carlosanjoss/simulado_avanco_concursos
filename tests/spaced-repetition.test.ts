import { describe, expect, it } from 'vitest'
import { nextReviewSchedule } from '@/lib/spaced-repetition'

const now = new Date('2026-10-09T12:00:00.000Z')

describe('spaced repetition schedule', () => {
  it('starts successful reviews with one day and then expands to six days', () => {
    const first = nextReviewSchedule({ repetitions: 0, intervalDays: 1, easeFactor: 2.5 }, 4, now)
    expect(first.repetitions).toBe(1)
    expect(first.intervalDays).toBe(1)
    expect(first.dueAt.toISOString()).toBe('2026-10-10T12:00:00.000Z')

    const second = nextReviewSchedule(first, 4, now)
    expect(second.repetitions).toBe(2)
    expect(second.intervalDays).toBe(6)
    expect(second.dueAt.toISOString()).toBe('2026-10-15T12:00:00.000Z')
  })

  it('resets an incorrect answer to a one-day interval', () => {
    const result = nextReviewSchedule({ repetitions: 4, intervalDays: 24, easeFactor: 2.3 }, 1, now)
    expect(result.repetitions).toBe(0)
    expect(result.intervalDays).toBe(1)
    expect(result.masteredAt).toBeNull()
  })

  it('marks a card as mastered after the fifth successful review', () => {
    const result = nextReviewSchedule({ repetitions: 4, intervalDays: 24, easeFactor: 2.3 }, 5, now)
    expect(result.repetitions).toBe(5)
    expect(result.masteredAt?.toISOString()).toBe(now.toISOString())
  })
})
