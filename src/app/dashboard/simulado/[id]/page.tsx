import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import SimuladoClient from './SimuladoClient'
import type { PublicQuestion, Question } from '@/types/quiz'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

interface SimuladoClientData {
  id: string
  titulo: string
  totalQuestoes: number
  temasFoco: string | null
  pdfNome: string
  questoesJson: PublicQuestion[]
  createdAt: string
}

async function getSimulado(simuladoId: string, userId: string) {
  const simulado = await prisma.simulado.findFirst({
    where: {
      id: simuladoId,
      userId: userId,
    },
    select: {
      id: true,
      titulo: true,
      totalQuestoes: true,
      temasFoco: true,
      pdfNome: true,
      questoesJson: true,
      createdAt: true,
    },
  })

  if (!simulado) return null

  const questions = (JSON.parse(simulado.questoesJson) as Question[]).map(
    ({ resposta_correta: _answer, justificativa: _explanation, sources: _sources, ...publicQuestion }) => publicQuestion,
  )

  return {
    ...simulado,
    questoesJson: questions,
    createdAt: simulado.createdAt.toISOString(),
  } as SimuladoClientData
}

interface SimuladoPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ retake?: string }>
}

export default async function SimuladoPage({ params, searchParams }: SimuladoPageProps) {
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) {
    redirect('/sign-in')
  }

  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const simulado = await getSimulado(id, user.id)

  if (!simulado) {
    notFound()
  }

  return <SimuladoClient simulado={simulado} forceRetake={query.retake === '1'} />
}
