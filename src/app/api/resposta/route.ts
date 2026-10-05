import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateAnswer } from '@/lib/quiz-evaluation';
import type { Question } from '@/types/quiz';
import { answerSubmissionSchema } from '@/lib/validations/attempt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const parsed = answerSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Resposta inválida' }, { status: 400 });
  }
  const body = parsed.data;

  const simulado = await prisma.simulado.findFirst({
    where: { id: body.simuladoId, user: { clerkId }, deletedAt: null },
    select: { questoesJson: true },
  });
  if (!simulado) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 });

  const question = (JSON.parse(simulado.questoesJson) as Question[])
    .find((item) => item.id === body.questionId);
  if (!question) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const activeKey = `${user.id}:${body.simuladoId}`;
  const existing = await prisma.tentativa.findUnique({ where: { activeKey } });
  const answers = existing ? JSON.parse(existing.respostas) as Record<string, string> : {};
  const firstUnanswered = Array.from({ length: 30 }, (_, index) => index + 1)
    .find((id) => answers[id] === undefined) ?? 31;
  if (body.questionId > firstUnanswered) {
    return NextResponse.json({ error: 'Responda as questões anteriores primeiro.' }, { status: 409 });
  }
  if (answers[body.questionId] !== undefined && answers[body.questionId] !== body.answer) {
    return NextResponse.json({ error: 'Esta resposta já foi confirmada.' }, { status: 409 });
  }
  answers[body.questionId] = body.answer;
  await prisma.tentativa.upsert({
    where: { activeKey },
    create: {
      activeKey,
      simuladoId: body.simuladoId,
      userId: user.id,
      respostas: JSON.stringify(answers),
      selectedAnswers: JSON.stringify(answers),
      pontuacao: 0,
      totalQuestoes: 30,
      percentual: 0,
      currentIndex: Math.min(body.questionId - 1, 29),
    },
    update: {
      respostas: JSON.stringify(answers),
      selectedAnswers: JSON.stringify(answers),
      currentIndex: Math.min(body.questionId - 1, 29),
    },
  });
  await prisma.simulado.update({ where: { id: body.simuladoId }, data: { status: 'EM_ANDAMENTO' } });

  return NextResponse.json({ evaluation: evaluateAnswer(question, body.answer) });
}
