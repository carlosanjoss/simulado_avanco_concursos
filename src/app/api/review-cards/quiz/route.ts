import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { questionSchema } from '@/lib/validations/quiz'
import type { Question } from '@/types/quiz'
import { getUserPlanAccess } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
  theme: z.string().trim().min(1).max(160).optional(),
  difficulty: z.enum(['Fácil', 'Médio', 'Avançado']).optional(),
  errorType: z.enum(['CONTENT', 'ATTENTION', 'DOUBT']).optional(),
  favoritesOnly: z.boolean().default(false),
  dueOnly: z.boolean().default(false),
}).strict()

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(await getUserPlanAccess(user)).reviewNotebook) return NextResponse.json({ error: 'O caderno de erros está disponível no plano Pro.' }, { status: 403 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Quantidade de questões inválida' }, { status: 400 })

  const cards = await prisma.reviewCard.findMany({
    where: {
      userId: user.id,
      masteredAt: null,
      ...(parsed.data.errorType ? { errorType: parsed.data.errorType } : {}),
      ...(parsed.data.favoritesOnly ? { favorite: true } : {}),
      ...(parsed.data.dueOnly ? { dueAt: { lte: new Date() } } : {}),
    },
    orderBy: [{ dueAt: 'asc' }, { repetitions: 'asc' }, { updatedAt: 'asc' }],
    take: 300,
  })

  const questions = cards.flatMap((card) => {
    try {
      const question = questionSchema.safeParse(JSON.parse(card.questionJson))
      if (!question.success) return []
      if (parsed.data.theme && question.data.tema !== parsed.data.theme) return []
      if (parsed.data.difficulty && question.data.dificuldade !== parsed.data.difficulty) return []
      return [{ ...question.data, reviewCardId: card.id } satisfies Question]
    } catch {
      return []
    }
  }).slice(0, parsed.data.limit).map((question, index) => ({ ...question, id: index + 1 }))

  if (!questions.length) {
    return NextResponse.json({ error: 'Não há questões pendentes válidas no caderno de erros.' }, { status: 409 })
  }

  const themes = [...new Set(questions.map((question) => question.tema))]
  const created = await prisma.$transaction(async (transaction) => {
    const simulado = await transaction.simulado.create({
      data: {
        userId: user.id,
        titulo: `Revisão personalizada · ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`,
        totalQuestoes: questions.length,
        temasFoco: themes.slice(0, 8).join(', '),
        pdfNome: 'Caderno de erros',
        pdfHash: `review-session:${randomUUID()}`,
        questoesJson: JSON.stringify(questions),
        difficultyTarget: 'MISTO',
      },
    })
    await transaction.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE_REVIEW_QUIZ',
        status: 'SUCCESS',
        metadata: JSON.stringify({ quizId: simulado.id, questionCount: questions.length, reviewCardIds: questions.map((question) => question.reviewCardId) }),
      },
    })
    return simulado
  })

  return NextResponse.json({ success: true, quizId: created.id, questionCount: questions.length })
}
