import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { estimateRetention, nextReviewSchedule } from '@/lib/spaced-repetition'
import { getUserPlanAccess } from '@/lib/plan-access'
import type { Question } from '@/types/quiz'

export const dynamic = 'force-dynamic'
const errorType = z.enum(['CONTENT', 'ATTENTION', 'DOUBT'])
const gradeSchema = z.object({ action: z.literal('grade').default('grade'), cardId: z.string().min(1).max(120), quality: z.number().int().min(0).max(5) }).strict()
const addSchema = z.object({ action: z.literal('add'), simuladoId: z.string().min(1).max(120), questionId: z.number().int().positive(), notes: z.string().trim().max(2000).optional(), errorType: errorType.default('DOUBT') }).strict()
const updateSchema = z.object({ cardId: z.string().min(1).max(120), notes: z.string().trim().max(2000).optional(), favorite: z.boolean().optional(), errorType: errorType.optional() }).strict()

async function authorized(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (!(await getUserPlanAccess(user)).reviewNotebook) return { error: NextResponse.json({ error: 'O caderno de erros está disponível no plano Pro.' }, { status: 403 }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const query = new URL(request.url).searchParams
  const due = query.get('due')
  const favorite = query.get('favorite')
  const type = query.get('type')
  const now = new Date()
  const cards = await prisma.reviewCard.findMany({
    where: { userId: auth.user.id, masteredAt: null, ...(due === 'true' ? { dueAt: { lte: now } } : due === 'future' ? { dueAt: { gt: now } } : {}), ...(favorite === 'true' ? { favorite: true } : {}), ...(type && errorType.safeParse(type).success ? { errorType: type } : {}) },
    orderBy: [{ favorite: 'desc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }], take: 300,
    include: { simulado: { select: { titulo: true } } },
  })
  return NextResponse.json({ cards: cards.map((card) => ({ ...card, retention: estimateRetention(card, now), question: JSON.parse(card.questionJson) })) })
}

export async function POST(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const body = await request.json().catch(() => null)
  const add = addSchema.safeParse(body)
  if (add.success) {
    const simulado = await prisma.simulado.findFirst({ where: { id: add.data.simuladoId, userId: auth.user.id, deletedAt: null } })
    if (!simulado) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 })
    const question = (JSON.parse(simulado.questoesJson) as Question[]).find((item) => item.id === add.data.questionId)
    if (!question) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
    const card = await prisma.reviewCard.upsert({
      where: { userId_simuladoId_questionId: { userId: auth.user.id, simuladoId: simulado.id, questionId: question.id } },
      create: { userId: auth.user.id, simuladoId: simulado.id, questionId: question.id, questionJson: JSON.stringify(question), notes: add.data.notes, errorType: add.data.errorType, manual: true, favorite: true, dueAt: new Date() },
      update: { questionJson: JSON.stringify(question), notes: add.data.notes, errorType: add.data.errorType, manual: true, favorite: true, masteredAt: null },
    })
    return NextResponse.json({ success: true, cardId: card.id })
  }
  const parsed = gradeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Revisão inválida' }, { status: 400 })
  const card = await prisma.reviewCard.findFirst({ where: { id: parsed.data.cardId, userId: auth.user.id } })
  if (!card) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const now = new Date()
  const schedule = nextReviewSchedule(card, parsed.data.quality, now, card.errorType as 'CONTENT' | 'ATTENTION' | 'DOUBT')
  const updated = await prisma.reviewCard.update({ where: { id: card.id }, data: { ...schedule, lastReviewedAt: now } })
  return NextResponse.json({
    success: true,
    dueAt: updated.dueAt,
    mastered: Boolean(updated.masteredAt),
    retention: estimateRetention(updated, now),
    repetitions: updated.repetitions,
    intervalDays: updated.intervalDays,
    easeFactor: updated.easeFactor,
    lapses: updated.lapses,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const current = await prisma.reviewCard.findFirst({ where: { id: parsed.data.cardId, userId: auth.user.id } })
  if (!current) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const updated = await prisma.reviewCard.update({ where: { id: current.id }, data: { notes: parsed.data.notes, favorite: parsed.data.favorite, errorType: parsed.data.errorType } })
  return NextResponse.json({ success: true, card: updated })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const cardId = new URL(request.url).searchParams.get('cardId')
  if (!cardId) return NextResponse.json({ error: 'Questão obrigatória' }, { status: 400 })
  await prisma.reviewCard.deleteMany({ where: { id: cardId, userId: auth.user.id } })
  return NextResponse.json({ success: true })
}
