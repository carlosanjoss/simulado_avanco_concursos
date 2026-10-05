import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';
import { getMonthlyUsage, MONTHLY_QUIZ_LIMIT } from '@/lib/usage-limit';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  const simulados = user
    ? await prisma.simulado.findMany({
        where: { userId: user.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          titulo: true,
          totalQuestoes: true,
          temasFoco: true,
          pdfNome: true,
          status: true,
          createdAt: true,
          tentativas: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { pontuacao: true, percentual: true, concluidoEm: true, currentIndex: true },
          },
        },
      })
    : [];

  const completedAttempts = user
    ? await prisma.tentativa.findMany({
        where: { userId: user.id, concluidoEm: { not: null } },
        select: { percentual: true, totalQuestoes: true },
      })
    : [];
  const usage = user ? await getMonthlyUsage(user.id, user.email) : { used: 0, limit: MONTHLY_QUIZ_LIMIT, remaining: MONTHLY_QUIZ_LIMIT, unlimited: false, monthKey: '' };
  const average = completedAttempts.length
    ? Math.round(completedAttempts.reduce((sum, attempt) => sum + attempt.percentual, 0) / completedAttempts.length)
    : 0;

  return (
    <DashboardClient
      isAdmin={user?.isAdmin ?? false}
      simulados={simulados.map((simulado) => ({
        id: simulado.id,
        titulo: simulado.titulo,
        totalQuestoes: simulado.totalQuestoes,
        temasFoco: simulado.temasFoco,
        pdfNome: simulado.pdfNome,
        status: simulado.status,
        createdAt: simulado.createdAt.toISOString(),
        tentativa: simulado.tentativas[0]
          ? { ...simulado.tentativas[0], concluidoEm: simulado.tentativas[0].concluidoEm?.toISOString() || null }
          : null,
      }))}
      stats={{
        completed: completedAttempts.length,
        average,
        answered: completedAttempts.reduce((sum, attempt) => sum + attempt.totalQuestoes, 0),
        remaining: usage.remaining,
        used: usage.used,
        unlimited: usage.unlimited,
      }}
    />
  );
}
