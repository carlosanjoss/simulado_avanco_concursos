import 'server-only'
import { prisma } from '@/lib/prisma'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import { nextReviewSchedule } from '@/lib/spaced-repetition'
import type { Question } from '@/types/quiz'

export async function syncReviewCardsFromAttempt(input: { userId: string; simuladoId: string; questions: Question[]; answers: Record<string, string> }) {
  const linkedCardIds = input.questions.flatMap((question) => question.reviewCardId ? [question.reviewCardId] : [])
  const [existing, linkedCards] = await Promise.all([
    prisma.reviewCard.findMany({ where: { userId: input.userId, simuladoId: input.simuladoId } }),
    linkedCardIds.length
      ? prisma.reviewCard.findMany({ where: { userId: input.userId, id: { in: linkedCardIds } } })
      : Promise.resolve([]),
  ])
  const byQuestion = new Map(existing.map((card) => [card.questionId, card]))
  const linkedById = new Map(linkedCards.map((card) => [card.id, card]))
  const now = new Date()

  await prisma.$transaction(input.questions.flatMap((question) => {
    const answer = input.answers[String(question.id)] || input.answers[question.id]
    const evaluation = evaluateAnswer(question, answer)
    const linkedCard = question.reviewCardId ? linkedById.get(question.reviewCardId) : undefined
    if (linkedCard) {
      const schedule = nextReviewSchedule(linkedCard, evaluation.correct ? 4 : 1, now)
      return [prisma.reviewCard.update({
        where: { id: linkedCard.id },
        data: { ...schedule, lastAnswer: answer, lastReviewedAt: now },
      })]
    }
    const card = byQuestion.get(question.id)
    if (!evaluation.correct) {
      return [prisma.reviewCard.upsert({
        where: { userId_simuladoId_questionId: { userId: input.userId, simuladoId: input.simuladoId, questionId: question.id } },
        create: { userId: input.userId, simuladoId: input.simuladoId, questionId: question.id, questionJson: JSON.stringify(question), lastAnswer: answer, dueAt: now },
        update: { questionJson: JSON.stringify(question), lastAnswer: answer, repetitions: 0, intervalDays: 1, dueAt: now, masteredAt: null },
      })]
    }
    if (!card) return []
    const schedule = nextReviewSchedule(card, 4, now)
    return [prisma.reviewCard.update({
      where: { id: card.id },
      data: { ...schedule, lastAnswer: answer, lastReviewedAt: now },
    })]
  }))
}
