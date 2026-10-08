import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import type { Question } from '@/types/quiz'
import QuestionBankClient from './QuestionBankClient'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function QuestionBankPage() {
  // Ler token do cookie via headers
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')

  const simulados = await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, titulo: true, questoesJson: true },
  })

  const questions = simulados.flatMap((simulado) => (JSON.parse(simulado.questoesJson) as Question[]).map((question) => ({
    key: `${simulado.id}-${question.id}`,
    simuladoId: simulado.id,
    simuladoTitulo: simulado.titulo,
    id: question.id,
    tema: question.tema?.trim() || simulado.titulo,
    enunciado: question.enunciado,
    opcoes: question.opcoes,
    dificuldade: question.dificuldade,
  })))

  return <DashboardShell><QuestionBankClient questions={questions} /></DashboardShell>
}
