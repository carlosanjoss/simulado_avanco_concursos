import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import SimuladoClient from './SimuladoClient';
import type { PublicQuestion, Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

interface SimuladoClientData {
  id: string;
  titulo: string;
  totalQuestoes: number;
  temasFoco: string | null;
  pdfNome: string;
  questoesJson: PublicQuestion[];
  createdAt: string;
}

async function getSimulado(simuladoId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) return null;

  const simulado = await prisma.simulado.findFirst({
    where: {
      id: simuladoId,
      userId: user.id,
    },
    select: {
      id: true,
      titulo: true,
      totalQuestoes: true,
      temasFoco: true,
      pdfNome: true,
      questoesJson: true,
      createdAt: true,
    },
  });

  if (!simulado) return null;

  const questions = (JSON.parse(simulado.questoesJson) as Question[]).map(
    ({ resposta_correta: _answer, justificativa: _explanation, sources: _sources, ...publicQuestion }) => publicQuestion,
  );

  return {
    ...simulado,
    questoesJson: questions,
    createdAt: simulado.createdAt.toISOString(),
  } as SimuladoClientData;
}

interface SimuladoPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ retake?: string }>;
}

export default async function SimuladoPage({ params, searchParams }: SimuladoPageProps) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const simulado = await getSimulado(id, userId);

  if (!simulado) {
    notFound();
  }

  return <SimuladoClient simulado={simulado} forceRetake={query.retake === '1'} />;
}
