import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns'

export interface StudyPlanSettingsInput {
  examName?: string | null
  examDate?: Date | null
  availableDays: number[]
  minutesPerDay: number
  weeklyGoal: number
  notificationsEnabled: boolean
}

export interface ThemePerformance {
  theme: string
  correct: number
  total: number
  dueReviews: number
}

export interface AdaptiveStudyTask {
  id: string
  scheduledDate: string
  dayLabel: string
  theme: string
  title: string
  detail: string
  duration: number
  mode: 'Revisão espaçada' | 'Prática dirigida' | 'Consolidação'
  priority: number
  focusUrl: string
}

export function getStudyWeekKey(date = new Date()) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

export function buildAdaptiveStudyTasks(input: {
  settings: StudyPlanSettingsInput
  performance: ThemePerformance[]
  carryoverThemes?: string[]
  now?: Date
}): AdaptiveStudyTask[] {
  const now = startOfDay(input.now || new Date())
  const days = new Set(input.settings.availableDays.length ? input.settings.availableDays : [1, 2, 3, 4, 5])
  const availableDates = Array.from({ length: 14 }, (_, index) => addDays(now, index)).filter((date) => days.has(date.getDay()))
  const goal = Math.max(1, Math.min(input.settings.weeklyGoal, Math.max(1, availableDates.length), 14))
  const examDays = input.settings.examDate ? Math.max(0, differenceInCalendarDays(input.settings.examDate, now)) : null
  const urgencyBoost = examDays !== null && examDays <= 30 ? 15 : 0
  const carryover = new Set(input.carryoverThemes || [])
  const ranked = [...input.performance]
    .map((item) => {
      const accuracy = item.total ? item.correct / item.total : 0.5
      const priority = Math.round((1 - accuracy) * 70 + Math.min(item.dueReviews, 5) * 6 + (carryover.has(item.theme) ? 12 : 0) + urgencyBoost)
      return { ...item, priority, accuracy }
    })
    .sort((a, b) => b.priority - a.priority || b.total - a.total || a.theme.localeCompare(b.theme, 'pt-BR'))
  const themes = ranked.length ? ranked : [{ theme: 'Revisão geral', correct: 0, total: 0, dueReviews: 0, priority: 50, accuracy: 0 }]

  return availableDates.slice(0, goal).map((date, index) => {
    const item = themes[index % themes.length]
    const mode = item.dueReviews > 0 || index % 3 === 0 ? 'Revisão espaçada' : index % 3 === 1 ? 'Prática dirigida' : 'Consolidação'
    const duration = Math.max(15, Math.min(input.settings.minutesPerDay, mode === 'Prática dirigida' ? input.settings.minutesPerDay : Math.round(input.settings.minutesPerDay * 0.75)))
    const scheduledDate = format(date, 'yyyy-MM-dd')
    const title = mode === 'Revisão espaçada' ? `Revisar ${item.theme}` : mode === 'Prática dirigida' ? `Praticar ${item.theme}` : `Consolidar ${item.theme}`
    const accuracyText = item.total ? `${Math.round(item.accuracy * 100)}% de acertos` : 'tema ainda sem histórico suficiente'
    return {
      id: `${scheduledDate}:${slug(item.theme)}:${slug(mode)}`,
      scheduledDate,
      dayLabel: index === 0 ? 'Próxima sessão' : format(date, 'dd/MM'),
      theme: item.theme,
      title,
      detail: `${accuracyText}${item.dueReviews ? ` · ${item.dueReviews} revisão(ões) pendente(s)` : ''}`,
      duration,
      mode,
      priority: item.priority,
      focusUrl: `/dashboard/novo?focus=${encodeURIComponent(item.theme)}`,
    }
  })
}

export function calculateStudyStreak(completedDates: Date[], now = new Date()): number {
  const unique = new Set(completedDates.map((date) => format(startOfDay(date), 'yyyy-MM-dd')))
  let cursor = startOfDay(now)
  if (!unique.has(format(cursor, 'yyyy-MM-dd'))) cursor = addDays(cursor, -1)
  let streak = 0
  while (unique.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}
