import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, FileText, Layers3 } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import type { Question } from '@/types/quiz'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'
import SubjectsGridClient from './SubjectsGridClient'

export const dynamic = 'force-dynamic'

export default async function MateriasPage() {
  // Ler token do cookie via headers
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) {
    redirect('/sign-in')
  }

  const simulados = await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, titulo: true, pdfNome: true, questoesJson: true, status: true },
  })

  const subjects = new Map<string, { questions: number; simulations: Set<string>; latestQuizId: string }>()
  simulados.forEach((simulado) => {
    const questions = JSON.parse(simulado.questoesJson) as Question[]
    questions.forEach((question) => {
      const label = question.tema?.trim() || simulado.titulo
      const current = subjects.get(label) || { questions: 0, simulations: new Set<string>(), latestQuizId: simulado.id }
      current.questions += 1
      current.simulations.add(simulado.id)
      subjects.set(label, current)
    })
  })
  const orderedSubjects = Array.from(subjects.entries()).sort((a, b) => b[1].questions - a[1].questions)

  return <DashboardShell><div className="mx-auto max-w-6xl p-4 pb-10 sm:p-6 lg:p-7">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Biblioteca de conteúdo</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Matérias</h1><p className="text-slate-600 mt-2">Assuntos identificados nos seus simulados e PDFs.</p></div><Link href="/dashboard/novo" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white">Adicionar material</Link></div>
    <div className="grid sm:grid-cols-3 gap-4 mt-7">
      <Summary icon={BookOpen} value={orderedSubjects.length} label="Matérias identificadas" />
      <Summary icon={FileText} value={simulados.length} label="Materiais processados" />
      <Summary icon={Layers3} value={orderedSubjects.reduce((sum, [, item]) => sum + item.questions, 0)} label="Questões disponíveis" />
    </div>
    {orderedSubjects.length ? <SubjectsGridClient subjects={orderedSubjects.map(([label, item]) => ({ label, questions: item.questions, simulations: item.simulations.size, latestQuizId: item.latestQuizId }))} /> : <EmptyState />}
  </div></DashboardShell>
}

function Summary({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return <article className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4"><span className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center"><Icon className="w-6 h-6" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-sm text-slate-600">{label}</p></div></article>
}

function EmptyState() {
  return <section className="mt-7 bg-white border border-slate-200 rounded-3xl p-12 text-center"><BookOpen className="w-12 h-12 text-blue-600 mx-auto" /><h2 className="text-xl font-black mt-4">Suas matérias aparecerão aqui</h2><p className="text-slate-600 mt-2">Crie um simulado para identificar e organizar automaticamente os temas do PDF.</p></section>
}
