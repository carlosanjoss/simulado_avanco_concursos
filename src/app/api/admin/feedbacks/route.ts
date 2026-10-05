import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Skip auth during build time
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ feedbacks: [] });
    }

    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const feedbacks = await prisma.questionFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, name: true, imageUrl: true },
        },
        simulado: {
          select: { id: true, titulo: true, pdfNome: true },
        },
      },
    }) as any;

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Error in admin feedbacks:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}