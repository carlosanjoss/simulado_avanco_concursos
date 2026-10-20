import { endOfDay, startOfDay } from 'date-fns'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { calculateStudyStreak } from '@/lib/study-plan'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import type { Question } from '@/types/quiz'
import TodayClient from './TodayClient'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const [tasks, dueReviews, attemptsToday, recentAttempts, activeAttempt, progressHistory, activeNotice] = await Promise.all([
    prisma.studyPlanProgress.findMany({ where: { userId: user.id, OR: [{ scheduledDate: { gte: todayStart, lte: todayEnd } }, { scheduledDate: { lt: todayStart }, completed: false }] }, orderBy: [{ completed: 'asc' }, { scheduledDate: 'asc' }], take: 8 }),
    prisma.reviewCard.count({ where: { userId: user.id, masteredAt: null, dueAt: { lte: now } } }),
    prisma.tentativa.findMany({ where: { userId: user.id, concluidoEm: { gte: todayStart, lte: todayEnd } }, select: { durationSeconds: true, totalQuestoes: true } }),
    prisma.tentativa.findMany({ where: { userId: user.id, concluidoEm: { not: null } }, include: { simulado: { select: { questoesJson: true } } }, orderBy: { concluidoEm: 'desc' }, take: 12 }),
    prisma.tentativa.findFirst({ where: { userId: user.id, activeKey: { not: null } }, include: { simulado: { select: { id: true, titulo: true, totalQuestoes: true } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.studyPlanProgress.findMany({ where: { userId: user.id, completedAt: { not: null } }, select: { completedAt: true } }),
    prisma.examNotice.findFirst({ where: { userId: user.id, active: true }, select: { id: true, title: true } }),
  ])

  const performance = new Map<string, { correct: number; total: number }>()
  for (const attempt of recentAttempts) {
    const questions = JSON.parse(attempt.simulado.questoesJson) as Question[]
    const answers = JSON.parse(attempt.respostas || '{}') as Record<string, string>
    for (const question of questions) {
      const result = evaluateAnswer(question, answers[String(question.id)])
      if (result.correct === null) continue
      const theme = question.tema || 'Revisão geral'
      const item = performance.get(theme) || { correct: 0, total: 0 }
      item.total += 1; if (result.correct) item.correct += 1
      performance.set(theme, item)
    }
  }
  const weakTopics = [...performance.entries()].map(([theme, value]) => ({ theme, accuracy: Math.round((value.correct / value.total) * 100), answered: value.total })).sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered).slice(0, 3)
  const completedToday = tasks.filter((task) => task.completed && task.completedAt && task.completedAt >= todayStart).length
  const dailyMinutes = Math.round(attemptsToday.reduce((sum, attempt) => sum + (attempt.durationSeconds || 0), 0) / 60)

  return <DashboardShell><TodayClient
    dateLabel={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(now)}
    tasks={tasks.map((task) => ({ id: task.id, taskKey: task.taskKey, weekKey: task.weekKey, theme: task.theme || 'Revisão geral', mode: task.mode || 'Estudo', duration: task.durationMinutes || 30, completed: task.completed, overdue: Boolean(task.scheduledDate && task.scheduledDate < todayStart) }))}
    dueReviews={dueReviews} dailyMinutes={dailyMinutes} answeredToday={attemptsToday.reduce((sum, attempt) => sum + attempt.totalQuestoes, 0)}
    completedToday={completedToday} streak={calculateStudyStreak(progressHistory.flatMap((item) => item.completedAt ? [item.completedAt] : []), now)}
    weakTopics={weakTopics} activeQuiz={activeAttempt ? { id: activeAttempt.simulado.id, title: activeAttempt.simulado.titulo, current: activeAttempt.currentIndex + 1, total: activeAttempt.simulado.totalQuestoes } : null}
    activeNotice={activeNotice}
  /></DashboardShell>
}
