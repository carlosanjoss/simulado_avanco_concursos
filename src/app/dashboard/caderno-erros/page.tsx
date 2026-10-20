import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getUserPlanAccess } from '@/lib/plan-access'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { estimateRetention } from '@/lib/spaced-repetition'
import { questionSchema } from '@/lib/validations/quiz'
import ReviewCardsClient from './ReviewCardsClient'

export const dynamic = 'force-dynamic'

export default async function ReviewNotebookPage() {
  const cookie = (await headers()).get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')

  const access = await getUserPlanAccess(user)
  if (!access.reviewNotebook) redirect('/dashboard/planos')

  const [cards, simulados] = await Promise.all([
    prisma.reviewCard.findMany({
      where: { userId: user.id, masteredAt: null },
      orderBy: [{ favorite: 'desc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 300,
      include: { simulado: { select: { titulo: true } } },
    }),
    prisma.simulado.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, titulo: true, questoesJson: true },
    }),
  ])

  const now = new Date()
  const validCards = cards.flatMap((card) => {
    try {
      const parsed = questionSchema.safeParse(JSON.parse(card.questionJson))
      if (!parsed.success) return []
      return [{
        id: card.id,
        simuladoId: card.simuladoId,
        simuladoTitulo: card.simulado.titulo,
        question: parsed.data,
        lastAnswer: card.lastAnswer,
        repetitions: card.repetitions,
        intervalDays: card.intervalDays,
        easeFactor: card.easeFactor,
        dueAt: card.dueAt.toISOString(),
        lastReviewedAt: card.lastReviewedAt?.toISOString() || null,
        retention: estimateRetention(card, now),
        notes: card.notes,
        favorite: card.favorite,
        errorType: card.errorType as 'CONTENT' | 'ATTENTION' | 'DOUBT',
        manual: card.manual,
        lapses: card.lapses,
      }]
    } catch {
      return []
    }
  })

  const existing = new Set(cards.map((card) => `${card.simuladoId}:${card.questionId}`))
  const candidates = simulados.flatMap((simulado) => {
    try {
      const raw = JSON.parse(simulado.questoesJson)
      if (!Array.isArray(raw)) return []
      return raw.flatMap((item) => {
        const parsed = questionSchema.safeParse(item)
        if (!parsed.success || existing.has(`${simulado.id}:${parsed.data.id}`)) return []
        return [{
          simuladoId: simulado.id,
          simuladoTitulo: simulado.titulo,
          questionId: parsed.data.id,
          theme: parsed.data.tema,
          difficulty: parsed.data.dificuldade,
          statement: parsed.data.enunciado,
        }]
      })
    } catch {
      return []
    }
  }).slice(0, 300)

  return <DashboardShell><ReviewCardsClient initialCards={validCards} candidates={candidates} /></DashboardShell>
}
