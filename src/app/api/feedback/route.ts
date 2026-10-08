import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { feedbackSubmissionSchema } from '@/lib/validations/attempt';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ success: true, feedbackId: 'build' });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const parsed = feedbackSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }
    const { simuladoId, questaoId, type, message } = parsed.data;

    const simulado = await prisma.simulado.findFirst({
      where: { id: simuladoId, userId: user.id },
    });

    if (!simulado) {
      return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 });
    }

    const feedback = await prisma.questionFeedback.create({
      data: {
        simuladoId,
        questaoId,
        userId: user.id,
        type,
        message: message.trim(),
      },
    });

    return NextResponse.json({ success: true, feedbackId: feedback.id });

  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
