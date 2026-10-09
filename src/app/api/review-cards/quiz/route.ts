import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { questionSchema } from '@/lib/validations/quiz'
import type { Question } from '@/types/quiz'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({ limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10) }).strict()

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Quantidade de questões inválida' }, { status: 400 })

  const cards = await prisma.reviewCard.findMany({
    where: { userId: user.id, masteredAt: null },
    orderBy: [{ dueAt: 'asc' }, { repetitions: 'asc' }, { updatedAt: 'asc' }],
    take: parsed.data.limit,
  })

  const questions = cards.flatMap((card, index) => {
    try {
      const question = questionSchema.safeParse(JSON.parse(card.questionJson))
      if (!question.success) return []
      return [{ ...question.data, id: index + 1, reviewCardId: card.id } satisfies Question]
    } catch {
      return []
    }
  }).map((question, index) => ({ ...question, id: index + 1 }))

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
