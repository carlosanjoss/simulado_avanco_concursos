import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserPlanAccess } from '@/lib/plan-access'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { questionSchema } from '@/lib/validations/quiz'
import type { Question } from '@/types/quiz'

const requestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  questions: z.array(z.object({ simuladoId: z.string().min(1).max(120), questionId: z.number().int().positive() }).strict()).min(1).max(50),
}).strict()

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(await getUserPlanAccess(user)).fullQuestionBank) return NextResponse.json({ error: 'O banco de questões está disponível no plano Pro.' }, { status: 403 })
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Selecione entre 1 e 50 questões e informe um título.' }, { status: 400 })
  const ids = [...new Set(parsed.data.questions.map((item) => item.simuladoId))]
  const simulados = await prisma.simulado.findMany({ where: { id: { in: ids }, userId: user.id, deletedAt: null }, select: { id: true, questoesJson: true } })
  const byId = new Map(simulados.map((simulado) => [simulado.id, simulado]))
  const selected = parsed.data.questions.flatMap((selection) => {
    const simulado = byId.get(selection.simuladoId); if (!simulado) return []
    const question = (JSON.parse(simulado.questoesJson) as unknown[]).map((item) => questionSchema.safeParse(item)).find((item) => item.success && item.data.id === selection.questionId)
    return question?.success ? [question.data] : []
  })
  if (selected.length !== parsed.data.questions.length) return NextResponse.json({ error: 'Uma ou mais questões não estão disponíveis.' }, { status: 409 })
  const questions: Question[] = selected.map((question, index) => ({ ...question, id: index + 1 }))
  const created = await prisma.simulado.create({ data: {
    userId: user.id, titulo: parsed.data.title, totalQuestoes: questions.length,
    temasFoco: [...new Set(questions.map((question) => question.tema))].slice(0, 8).join(', '),
    pdfNome: 'Banco de questões', pdfHash: `manual-bank:${randomUUID()}`, questoesJson: JSON.stringify(questions), difficultyTarget: 'MISTO',
  } })
  await prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE_MANUAL_QUIZ', status: 'SUCCESS', metadata: JSON.stringify({ quizId: created.id, questionCount: questions.length }) } })
  return NextResponse.json({ success: true, quizId: created.id, questionCount: questions.length })
}
