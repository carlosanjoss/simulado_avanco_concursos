import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProFeatureNotice } from '@/components/billing/ProFeatureNotice'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import { questionSchema } from '@/lib/validations/quiz'
import ReportsClient from './ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const access = await getUserPlanAccess(user)
  if (!access.advancedReports) return <DashboardShell><ProFeatureNotice title="Relatórios avançados" description="Compare períodos, filtre seus resultados e transforme pontos fracos em ações no plano de estudos." /></DashboardShell>

  const now = new Date()
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [attempts, dueReviews, settings, weeklyProgress, monthlyProgress, cohort] = await Promise.all([
    prisma.tentativa.findMany({ where: { userId: user.id }, include: { simulado: { select: { id: true, titulo: true, questoesJson: true, pdfNome: true, materials: { select: { fileName: true } } } } }, orderBy: { updatedAt: 'asc' }, take: 2000 }),
    prisma.reviewCard.count({ where: { userId: user.id, masteredAt: null, dueAt: { lte: now } } }),
    prisma.studyPlanSettings.findUnique({ where: { userId: user.id } }),
    prisma.studyPlanProgress.count({ where: { userId: user.id, completed: true, completedAt: { gte: weekStart } } }),
    prisma.studyPlanProgress.count({ where: { userId: user.id, completed: true, completedAt: { gte: monthStart } } }),
    prisma.tentativa.findMany({ where: { concluidoEm: { not: null } }, select: { userId: true, percentual: true }, orderBy: { concluidoEm: 'desc' }, take: 10_000 }),
  ])

  const records = attempts.map((attempt) => {
    let rawQuestions: unknown[] = []
    try { rawQuestions = JSON.parse(attempt.simulado.questoesJson) } catch { rawQuestions = [] }
    const questions = rawQuestions.flatMap((item) => { const parsed = questionSchema.safeParse(item); return parsed.success ? [parsed.data] : [] })
    let answers: Record<string, string> = {}
    try { answers = JSON.parse(attempt.respostas || attempt.selectedAnswers || '{}') } catch { answers = {} }
    const outcomes = questions.flatMap((question) => {
      const answer = answers[String(question.id)]
      if (!answer) return []
      const evaluation = evaluateAnswer(question, answer)
      if (evaluation.correct === null) return []
      return [{ key: `${attempt.simuladoId}:${question.id}`, questionId: question.id, theme: question.tema || 'Sem tema', difficulty: question.dificuldade, statement: question.enunciado, correct: evaluation.correct }]
    })
    const materials = attempt.simulado.materials.map((item) => item.fileName)
    return {
      id: attempt.id, simuladoId: attempt.simuladoId, title: attempt.simulado.titulo,
      date: (attempt.concluidoEm || attempt.updatedAt).toISOString(), completed: Boolean(attempt.concluidoEm),
      percent: attempt.percentual, durationSeconds: attempt.durationSeconds || 0, answered: outcomes.length,
      totalQuestions: attempt.totalQuestoes, currentIndex: attempt.currentIndex,
      abandoned: !attempt.concluidoEm && now.getTime() - attempt.updatedAt.getTime() >= 86_400_000,
      materials: materials.length ? materials : [attempt.simulado.pdfNome], outcomes,
    }
  })

  const cohortUsers = new Set(cohort.map((attempt) => attempt.userId)).size
  const benchmark = cohortUsers >= 20 && cohort.length >= 100
    ? { available: true, users: cohortUsers, attempts: cohort.length, average: Math.round(cohort.reduce((sum, attempt) => sum + attempt.percentual, 0) / cohort.length) }
    : { available: false, users: cohortUsers, attempts: cohort.length, average: null }

  return <DashboardShell><ReportsClient data={{
    records, dueReviews, benchmark,
    goals: { weeklyTarget: settings?.weeklyGoal || 5, weeklyCompleted: weeklyProgress, monthlyTarget: (settings?.weeklyGoal || 5) * 4, monthlyCompleted: monthlyProgress },
  }} /></DashboardShell>
}
