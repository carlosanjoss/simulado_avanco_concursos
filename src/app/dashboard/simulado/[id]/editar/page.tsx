import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import type { Question } from '@/types/quiz'
import QuestionEditorClient from './QuestionEditorClient'

export const dynamic = 'force-dynamic'

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const { id } = await params
  const simulado = await prisma.simulado.findFirst({ where: { id, userId: user.id, deletedAt: null }, include: { tentativas: { where: { concluidoEm: { not: null } }, select: { id: true }, take: 1 } } })
  if (!simulado) notFound()
  return <DashboardShell><QuestionEditorClient simuladoId={id} title={simulado.titulo} initialQuestions={JSON.parse(simulado.questoesJson) as Question[]} locked={simulado.tentativas.length > 0} /></DashboardShell>
}
