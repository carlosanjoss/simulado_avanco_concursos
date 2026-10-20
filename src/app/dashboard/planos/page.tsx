import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProFeatureNotice } from '@/components/billing/ProFeatureNotice'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import { buildAdaptiveStudyTasks, calculateStudyStreak, getStudyWeekKey, type ThemePerformance } from '@/lib/study-plan'
import type { Question } from '@/types/quiz'
import type { ParsedSyllabus } from '@/lib/syllabus'
import StudyPlanClient from './StudyPlanClient'

export const dynamic = 'force-dynamic'

export default async function StudyPlansPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const access = await getUserPlanAccess(user)
  if (!access.studyPlan) return <DashboardShell><ProFeatureNotice title="Plano de estudos sincronizado" description="Organize automaticamente sua semana com base nos conteúdos dos seus simulados e mantenha o progresso sincronizado na sua conta." /></DashboardShell>

  const now = new Date()
  const weekKey = getStudyWeekKey(now)
  const [attempts, reviewCards, settingsRecord, progress, historyRows, activeNotice] = await Promise.all([
    prisma.tentativa.findMany({ where: { userId: user.id, concluidoEm: { not: null } }, include: { simulado: { select: { questoesJson: true } } }, orderBy: { concluidoEm: 'desc' }, take: 30 }),
    prisma.reviewCard.findMany({ where: { userId: user.id, masteredAt: null }, select: { questionJson: true, dueAt: true } }),
    prisma.studyPlanSettings.findUnique({ where: { userId: user.id } }),
    prisma.studyPlanProgress.findMany({ where: { userId: user.id, weekKey }, orderBy: { scheduledDate: 'asc' } }),
    prisma.studyPlanProgress.findMany({ where: { userId: user.id }, orderBy: { weekKey: 'desc' }, take: 200 }),
    prisma.examNotice.findFirst({ where: { userId: user.id, active: true }, select: { syllabusJson: true } }),
  ])

  const performance = new Map<string, ThemePerformance>()
  for (const attempt of attempts) {
    const questions = JSON.parse(attempt.simulado.questoesJson) as Question[]
    const answers = JSON.parse(attempt.respostas || '{}') as Record<string, string>
    for (const question of questions) {
      const evaluation = evaluateAnswer(question, answers[String(question.id)])
      if (evaluation.correct === null) continue
      const theme = question.tema?.trim() || 'Revisão geral'
      const item = performance.get(theme) || { theme, correct: 0, total: 0, dueReviews: 0 }
      item.total += 1
      if (evaluation.correct) item.correct += 1
      performance.set(theme, item)
    }
  }
  for (const card of reviewCards) {
    const question = JSON.parse(card.questionJson) as Question
    const theme = question.tema?.trim() || 'Revisão geral'
    const item = performance.get(theme) || { theme, correct: 0, total: 0, dueReviews: 0 }
    if (card.dueAt <= now) item.dueReviews += 1
    performance.set(theme, item)
  }
  if (activeNotice) {
    try {
      const syllabus = JSON.parse(activeNotice.syllabusJson) as ParsedSyllabus
      for (const topic of syllabus.sections.flatMap((section) => section.topics).slice(0, 80)) {
        if (!performance.has(topic.title)) performance.set(topic.title, { theme: topic.title, correct: 0, total: 0, dueReviews: 0 })
      }
    } catch { /* edital legado inválido não impede o plano */ }
  }

  const settings = {
    examName: settingsRecord?.examName || '',
    examDate: settingsRecord?.examDate?.toISOString().slice(0, 10) || '',
    availableDays: JSON.parse(settingsRecord?.availableDays || '[1,2,3,4,5]') as number[],
    minutesPerDay: settingsRecord?.minutesPerDay || 45,
    weeklyGoal: settingsRecord?.weeklyGoal || 5,
    notificationsEnabled: settingsRecord?.notificationsEnabled ?? true,
  }
  const carryoverThemes = historyRows.filter((row) => row.weekKey < weekKey && !row.completed && row.theme).map((row) => row.theme!)
  const tasks = buildAdaptiveStudyTasks({ settings: { ...settings, examDate: settings.examDate ? new Date(`${settings.examDate}T12:00:00`) : null }, performance: [...performance.values()], carryoverThemes, now })
  const completed = progress.filter((item) => item.completed).map((item) => item.taskKey)
  const history = [...new Set(historyRows.map((item) => item.weekKey))].slice(0, 8).map((key) => {
    const items = historyRows.filter((item) => item.weekKey === key)
    return { weekKey: key, completed: items.filter((item) => item.completed).length, total: items.length }
  })
  const streak = calculateStudyStreak(historyRows.flatMap((item) => item.completedAt ? [item.completedAt] : []), now)
  const dueReviews = reviewCards.filter((card) => card.dueAt <= now).length

  return <DashboardShell><StudyPlanClient tasks={tasks} weekKey={weekKey} initialCompleted={completed} settings={settings} history={history} streak={streak} dueReviews={dueReviews} /></DashboardShell>
}
