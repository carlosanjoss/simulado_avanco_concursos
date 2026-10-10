import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { BarChart3, Brain, Clock3, Target, TrendingUp } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import type { Question } from '@/types/quiz'
import { getUserPlanAccess } from '@/lib/plan-access'
import { ProFeatureNotice } from '@/components/billing/ProFeatureNotice'

export const dynamic = 'force-dynamic'
type Group = { label: string; correct: number; total: number }

export default async function ReportsPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const access = await getUserPlanAccess(user)
  if (!access.advancedReports) return <DashboardShell><ProFeatureNotice title="Relatórios avançados" description="Compare seu desempenho por tema e dificuldade, acompanhe sua evolução e identifique os pontos que mais precisam de atenção." /></DashboardShell>
  const [attempts, dueReviews] = await Promise.all([
    prisma.tentativa.findMany({ where: { userId: user.id, concluidoEm: { not: null } }, include: { simulado: { select: { titulo: true, questoesJson: true } } }, orderBy: { concluidoEm: 'asc' } }),
    prisma.reviewCard.count({ where: { userId: user.id, masteredAt: null, dueAt: { lte: new Date() } } }),
  ])
  const themes = new Map<string, Group>(); const difficulties = new Map<string, Group>()
  let answered = 0; let correct = 0
  for (const attempt of attempts) {
    const answers = JSON.parse(attempt.respostas || '{}') as Record<string, string>
    const questions = JSON.parse(attempt.simulado.questoesJson) as Question[]
    for (const question of questions) {
      const evaluation = evaluateAnswer(question, answers[String(question.id)])
      if (evaluation.correct === null) continue
      answered += 1; if (evaluation.correct) correct += 1
      for (const [map, label] of [[themes, question.tema || 'Sem tema'], [difficulties, question.dificuldade]] as const) {
        const group = map.get(label) || { label, correct: 0, total: 0 }
        group.total += 1; if (evaluation.correct) group.correct += 1; map.set(label, group)
      }
    }
  }
  const average = answered ? Math.round(correct / answered * 100) : 0
  const avgMinutes = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / attempts.length / 60) : 0
  const recent = attempts.slice(-8)
  const groups = (map: Map<string, Group>) => [...map.values()].sort((a, b) => b.total - a.total)
  return <DashboardShell><div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Desempenho detalhado</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Relatórios avançados</h1><p className="mt-2 text-slate-600">Entenda sua evolução, os temas que precisam de atenção e o ritmo das revisões.</p>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[Target, `${average}%`, 'Aproveitamento geral'], [BarChart3, attempts.length, 'Simulados concluídos'], [Clock3, `${avgMinutes} min`, 'Tempo médio'], [Brain, dueReviews, 'Revisões pendentes']].map(([Icon, value, label]) => { const CardIcon = Icon as typeof Target; return <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><CardIcon className="h-6 w-6 text-blue-700" /><p className="mt-4 text-3xl font-black">{String(value)}</p><p className="mt-1 text-sm text-slate-500">{String(label)}</p></div> })}</section>
    {!attempts.length ? <section className="mt-7 rounded-3xl border border-blue-100 bg-blue-50 p-10 text-center"><TrendingUp className="mx-auto h-12 w-12 text-blue-700" /><h2 className="mt-4 text-xl font-black">Seu relatório começa no primeiro simulado</h2><p className="mt-2 text-slate-600">Conclua uma tentativa para liberar comparativos de temas e dificuldade.</p></section> : <div className="mt-7 grid gap-6 lg:grid-cols-2"><ReportGroup title="Desempenho por tema" groups={groups(themes).slice(0, 10)} /><ReportGroup title="Desempenho por dificuldade" groups={groups(difficulties)} /><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><h2 className="text-xl font-black">Evolução recente</h2><div className="mt-6 flex h-56 items-end gap-3">{recent.map((attempt) => <div key={attempt.id} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-xs font-black text-blue-800">{Math.round(attempt.percentual)}%</span><div className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-sky-400" style={{ height: `${Math.max(8, attempt.percentual)}%` }} /><span className="w-full truncate text-center text-[10px] text-slate-500" title={attempt.simulado.titulo}>{attempt.simulado.titulo}</span></div>)}</div></section></div>}
  </div></DashboardShell>
}

function ReportGroup({ title, groups }: { title: string; groups: Group[] }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{title}</h2><div className="mt-5 space-y-5">{groups.map((group) => { const percent = group.total ? Math.round(group.correct / group.total * 100) : 0; return <div key={group.label}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-bold">{group.label}</span><span className="shrink-0 text-slate-500">{percent}% · {group.correct}/{group.total}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percent >= 70 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percent}%` }} /></div></div> })}</div></section>
}
