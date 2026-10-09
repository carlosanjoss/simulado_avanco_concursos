import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import type { Question } from '@/types/quiz'
import ReviewCardsClient from './ReviewCardsClient'

export const dynamic = 'force-dynamic'

export default async function ReviewNotebookPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const now = new Date()
  const [cards, pendingCount] = await Promise.all([
    prisma.reviewCard.findMany({
      where: { userId: user.id, masteredAt: null, dueAt: { lte: now } },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      include: { simulado: { select: { titulo: true } } },
      take: 100,
    }),
    prisma.reviewCard.count({ where: { userId: user.id, masteredAt: null } }),
  ])
  return <DashboardShell><ReviewCardsClient pendingCount={pendingCount} initialCards={cards.map((card) => ({ id: card.id, simuladoId: card.simuladoId, simuladoTitulo: card.simulado.titulo, question: JSON.parse(card.questionJson) as Question, lastAnswer: card.lastAnswer, repetitions: card.repetitions }))} /></DashboardShell>
}
