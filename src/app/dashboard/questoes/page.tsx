import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { prisma } from '@/lib/prisma';
import type { Question } from '@/types/quiz';
import QuestionBankClient from './QuestionBankClient';

export default async function QuestionBankPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  const simulados = user ? await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, titulo: true, questoesJson: true },
  }) : [];
  const questions = simulados.flatMap((simulado) => (JSON.parse(simulado.questoesJson) as Question[]).map((question) => ({
    key: `${simulado.id}-${question.id}`,
    simuladoId: simulado.id,
    simuladoTitulo: simulado.titulo,
    id: question.id,
    tema: question.tema?.trim() || simulado.titulo,
    enunciado: question.enunciado,
    opcoes: question.opcoes,
    dificuldade: question.dificuldade,
  })));
  return <DashboardShell><QuestionBankClient questions={questions} /></DashboardShell>;
}
