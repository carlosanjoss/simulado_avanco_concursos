import { describe, expect, it } from 'vitest'
import { buildAdaptiveStudyTasks, calculateStudyStreak } from '@/lib/study-plan'

const settings = { availableDays: [1, 3, 5], minutesPerDay: 60, weeklyGoal: 3, notificationsEnabled: true }

describe('adaptive study plan', () => {
  it('prioritizes low performance and due reviews', () => {
    const tasks = buildAdaptiveStudyTasks({
      settings,
      now: new Date('2026-10-12T12:00:00.000Z'),
      performance: [
        { theme: 'Direito Penal', correct: 9, total: 10, dueReviews: 0 },
        { theme: 'Português', correct: 2, total: 10, dueReviews: 3 },
      ],
    })
    expect(tasks[0].theme).toBe('Português')
    expect(tasks[0].mode).toBe('Revisão espaçada')
  })

  it('uses only available days and respects daily minutes', () => {
    const tasks = buildAdaptiveStudyTasks({ settings, now: new Date('2026-10-12T12:00:00.000Z'), performance: [] })
    expect(tasks).toHaveLength(3)
    expect(tasks.every((task) => settings.availableDays.includes(new Date(`${task.scheduledDate}T12:00:00`).getDay()))).toBe(true)
    expect(tasks.every((task) => task.duration <= settings.minutesPerDay)).toBe(true)
  })

  it('calculates consecutive completed study days', () => {
    const streak = calculateStudyStreak([
      new Date('2026-10-10T12:00:00.000Z'),
      new Date('2026-10-11T12:00:00.000Z'),
      new Date('2026-10-12T12:00:00.000Z'),
    ], new Date('2026-10-12T20:00:00.000Z'))
    expect(streak).toBe(3)
  })
})
