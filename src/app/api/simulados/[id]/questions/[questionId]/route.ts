import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { buildQuizPrompts } from '@/lib/prompts/quiz-generation'
import { generateQuizBatchWithFallback } from '@/lib/ai-providers'
import type { Question } from '@/types/quiz'

const editSchema = z.object({
  tema: z.string().trim().min(2).max(120),
  enunciado: z.string().trim().min(10).max(5000),
  opcoes: z.array(z.string().trim().min(3).max(1000)).length(4),
  resposta_correta: z.enum(['A', 'B', 'C', 'D']),
  justificativa: z.string().trim().min(10).max(10000),
  dificuldade: z.enum(['Fácil', 'Médio', 'Avançado']),
}).strict()

type RouteContext = { params: Promise<{ id: string; questionId: string }> }

async function ownedSimulado(request: NextRequest, id: string) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  const simulado = await prisma.simulado.findFirst({ where: { id, userId: user.id, deletedAt: null }, include: { tentativas: { where: { concluidoEm: { not: null } }, select: { id: true }, take: 1 } } })
  if (!simulado) return { error: NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 }) }
  if (simulado.pdfHash.startsWith('review-session:')) return { error: NextResponse.json({ error: 'Questões de uma revisão são vinculadas ao caderno de erros e não podem ser alteradas.' }, { status: 409 }) }
  if (simulado.tentativas.length) return { error: NextResponse.json({ error: 'Um simulado concluído não pode ser alterado.' }, { status: 409 }) }
  return { user, simulado }
}

async function saveQuestion(userId: string, simuladoId: string, questions: Question[], question: Question, action: string) {
  const index = questions.findIndex((item) => item.id === question.id)
  questions[index] = question
  await prisma.$transaction([
    prisma.simulado.update({ where: { id: simuladoId }, data: { questoesJson: JSON.stringify(questions), status: 'NAO_INICIADO' } }),
    prisma.tentativa.deleteMany({ where: { userId, simuladoId, concluidoEm: null } }),
    prisma.auditLog.create({ data: { userId, action, status: 'SUCCESS', metadata: JSON.stringify({ simuladoId, questionId: question.id }) } }),
  ])
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, questionId } = await context.params
  const owned = await ownedSimulado(request, id); if ('error' in owned) return owned.error
  const questions = JSON.parse(owned.simulado.questoesJson) as Question[]
  const current = questions.find((item) => item.id === Number(questionId))
  if (!current) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const parsed = editSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revise os campos da questão.' }, { status: 400 })
  const updated: Question = { ...current, ...parsed.data, tipo: 'multipla_escolha', opcoes: parsed.data.opcoes.map((option, index) => `${String.fromCharCode(65 + index)}) ${option.replace(/^[A-D]\)\s*/i, '')}`) }
  await saveQuestion(owned.user.id, id, questions, updated, 'EDIT_QUESTION')
  return NextResponse.json({ question: updated })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id, questionId } = await context.params
  const owned = await ownedSimulado(request, id); if ('error' in owned) return owned.error
  const questions = JSON.parse(owned.simulado.questoesJson) as Question[]
  const current = questions.find((item) => item.id === Number(questionId))
  if (!current) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const sources = current.sources || []
  const sourceContext = sources.length ? sources.map((source) => `[${source.documentName || 'Material'} · Página ${source.pageNumber}] ${source.excerpt}`).join('\n\n') : `${current.enunciado}\n${current.justificativa}`
  const difficulty = ({ FACIL: 'Fácil', MEDIO: 'Médio', AVANCADO: 'Avançado', MISTO: 'Misto' } as const)[owned.simulado.difficultyTarget as 'FACIL' | 'MEDIO' | 'AVANCADO' | 'MISTO'] || 'Misto'
  const prompts = buildQuizPrompts({ context: sourceContext, focusTopics: current.tema, totalQuestions: owned.simulado.totalQuestoes, difficultyTarget: difficulty, batch: { number: current.id, startId: current.id, endId: current.id, previousQuestions: questions.filter((item) => item.id !== current.id).map((item) => item.enunciado) } })
  try {
    const generated = await generateQuizBatchWithFallback(prompts.systemPrompt, prompts.userPrompt, current.id)
    const regenerated: Question = { ...generated.batch.questoes[0], id: current.id, sources }
    await saveQuestion(owned.user.id, id, questions, regenerated, 'REGENERATE_QUESTION')
    return NextResponse.json({ question: regenerated })
  } catch (error) {
    await prisma.auditLog.create({ data: { userId: owned.user.id, action: 'REGENERATE_QUESTION', status: 'ERROR', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido', metadata: JSON.stringify({ simuladoId: id, questionId: current.id }) } })
    return NextResponse.json({ error: 'Não foi possível regenerar esta questão agora.' }, { status: 502 })
  }
}
