import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserPlanAccess } from '@/lib/plan-access'
import { getAuthenticatedUser } from '@/lib/server-auth'
import type { Question } from '@/types/quiz'
import { normalizeQuestionTags } from '@/lib/question-bank'

type Context = { params: Promise<{ simuladoId: string; questionId: string }> }
const updateSchema = z.object({
  favorite: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
  excluded: z.boolean().optional(),
  submitForCuration: z.boolean().optional(),
}).strict()

async function ownedQuestion(request: NextRequest, context: Context) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (!(await getUserPlanAccess(user)).fullQuestionBank) return { error: NextResponse.json({ error: 'O banco de questões está disponível no plano Pro.' }, { status: 403 }) }
  const { simuladoId, questionId: rawQuestionId } = await context.params
  const questionId = Number(rawQuestionId)
  if (!Number.isInteger(questionId) || questionId < 1) return { error: NextResponse.json({ error: 'Questão inválida' }, { status: 400 }) }
  const simulado = await prisma.simulado.findFirst({ where: { id: simuladoId, userId: user.id, deletedAt: null }, select: { id: true, questoesJson: true } })
  if (!simulado) return { error: NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 }) }
  const question = (JSON.parse(simulado.questoesJson) as Question[]).find((item) => item.id === questionId)
  if (!question) return { error: NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 }) }
  return { user, simulado, question, questionId }
}

export async function GET(request: NextRequest, context: Context) {
  const owned = await ownedQuestion(request, context); if ('error' in owned) return owned.error
  const entry = await prisma.questionBankEntry.findUnique({
    where: { userId_simuladoId_questionId: { userId: owned.user.id, simuladoId: owned.simulado.id, questionId: owned.questionId } },
    include: { versions: { orderBy: { version: 'desc' }, take: 20, select: { id: true, version: true, changeType: true, snapshotJson: true, createdAt: true } } },
  })
  return NextResponse.json({ versions: entry?.versions || [] })
}

export async function PATCH(request: NextRequest, context: Context) {
  const owned = await ownedQuestion(request, context); if ('error' in owned) return owned.error
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Metadados inválidos' }, { status: 400 })
  const data = parsed.data
  const entry = await prisma.questionBankEntry.upsert({
    where: { userId_simuladoId_questionId: { userId: owned.user.id, simuladoId: owned.simulado.id, questionId: owned.questionId } },
    create: {
      userId: owned.user.id, simuladoId: owned.simulado.id, questionId: owned.questionId,
      favorite: data.favorite || false, tags: JSON.stringify(normalizeQuestionTags(data.tags || [])), notes: data.notes,
      excludedAt: data.excluded ? new Date() : null, editorialStatus: data.submitForCuration ? 'PENDING' : 'PRIVATE',
    },
    update: {
      favorite: data.favorite, tags: data.tags ? JSON.stringify(normalizeQuestionTags(data.tags)) : undefined, notes: data.notes,
      excludedAt: data.excluded === undefined ? undefined : data.excluded ? new Date() : null,
      editorialStatus: data.submitForCuration ? 'PENDING' : undefined,
    },
  })
  return NextResponse.json({ success: true, entry: { ...entry, tags: JSON.parse(entry.tags) } })
}

export async function DELETE(request: NextRequest, context: Context) {
  const owned = await ownedQuestion(request, context); if ('error' in owned) return owned.error
  await prisma.questionBankEntry.upsert({
    where: { userId_simuladoId_questionId: { userId: owned.user.id, simuladoId: owned.simulado.id, questionId: owned.questionId } },
    create: { userId: owned.user.id, simuladoId: owned.simulado.id, questionId: owned.questionId, excludedAt: new Date() },
    update: { excludedAt: new Date() },
  })
  return NextResponse.json({ success: true })
}
