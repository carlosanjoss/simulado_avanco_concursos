import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { prisma } from '@/lib/prisma';
import type { Question } from '@/types/quiz';
import StudyPlanClient from './StudyPlanClient';

export default async function StudyPlansPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  const simulados = user ? await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { titulo: true, questoesJson: true },
  }) : [];
  const counts = new Map<string, number>();
  simulados.forEach((simulado) => (JSON.parse(simulado.questoesJson) as Question[]).forEach((question) => {
    const theme = question.tema?.trim() || simulado.titulo;
    counts.set(theme, (counts.get(theme) || 0) + 1);
  }));
  const themes = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([theme]) => theme);
  return <DashboardShell><StudyPlanClient themes={themes} /></DashboardShell>;
}
