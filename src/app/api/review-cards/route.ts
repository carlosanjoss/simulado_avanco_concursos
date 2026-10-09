import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { nextReviewSchedule } from '@/lib/spaced-repetition'

export const dynamic = 'force-dynamic'

const reviewSchema = z.object({ cardId: z.string().min(1).max(120), quality: z.number().int().min(0).max(5) }).strict()

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const dueOnly = new URL(request.url).searchParams.get('due') !== 'false'
  const cards = await prisma.reviewCard.findMany({
    where: { userId: user.id, masteredAt: null, ...(dueOnly ? { dueAt: { lte: new Date() } } : {}) },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 100,
    include: { simulado: { select: { titulo: true } } },
  })
  return NextResponse.json({ cards: cards.map((card) => ({ ...card, question: JSON.parse(card.questionJson) })) })
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisão inválida' }, { status: 400 })
  const card = await prisma.reviewCard.findFirst({ where: { id: parsed.data.cardId, userId: user.id } })
  if (!card) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const now = new Date()
  const schedule = nextReviewSchedule(card, parsed.data.quality, now)
  const updated = await prisma.reviewCard.update({ where: { id: card.id }, data: { ...schedule, lastReviewedAt: now } })
  return NextResponse.json({ success: true, dueAt: updated.dueAt, mastered: Boolean(updated.masteredAt) })
}
