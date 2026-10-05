import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ChevronRight, FileText, Layers3 } from 'lucide-react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { prisma } from '@/lib/prisma';
import type { Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export default async function MateriasPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  const simulados = user ? await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, titulo: true, pdfNome: true, questoesJson: true, status: true },
  }) : [];

  const subjects = new Map<string, { questions: number; simulations: Set<string>; latestQuizId: string }>();
  simulados.forEach((simulado) => {
    const questions = JSON.parse(simulado.questoesJson) as Question[];
    questions.forEach((question) => {
      const label = question.tema?.trim() || simulado.titulo;
      const current = subjects.get(label) || { questions: 0, simulations: new Set<string>(), latestQuizId: simulado.id };
      current.questions += 1;
      current.simulations.add(simulado.id);
      subjects.set(label, current);
    });
  });
  const orderedSubjects = Array.from(subjects.entries()).sort((a, b) => b[1].questions - a[1].questions);

  return <DashboardShell><div className="max-w-6xl mx-auto p-5 sm:p-8 pb-28">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Biblioteca de conteúdo</p><h1 className="text-3xl sm:text-4xl font-black mt-2">Matérias</h1><p className="text-slate-600 mt-2">Assuntos identificados nos seus simulados e PDFs.</p></div><Link href="/dashboard/novo" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white">Adicionar material</Link></div>
    <div className="grid sm:grid-cols-3 gap-4 mt-7">
      <Summary icon={BookOpen} value={orderedSubjects.length} label="Matérias identificadas" />
      <Summary icon={FileText} value={simulados.length} label="Materiais processados" />
      <Summary icon={Layers3} value={orderedSubjects.reduce((sum, [, item]) => sum + item.questions, 0)} label="Questões disponíveis" />
    </div>
    {orderedSubjects.length ? <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-7">{orderedSubjects.map(([label, item], index) => <article key={label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><BookOpen className="w-5 h-5" /></span><span className="text-xs font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</span></div><h2 className="font-black text-lg mt-4">{label}</h2><p className="text-sm text-slate-600 mt-1">{item.questions} questões em {item.simulations.size} simulado{item.simulations.size === 1 ? '' : 's'}</p><Link href={`/dashboard/simulado/${item.latestQuizId}`} className="mt-5 inline-flex items-center gap-1 text-sm font-black text-blue-700">Estudar matéria <ChevronRight className="w-4 h-4" /></Link></article>)}</section> : <EmptyState />}
  </div></DashboardShell>;
}

function Summary({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return <article className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4"><span className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center"><Icon className="w-6 h-6" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-sm text-slate-600">{label}</p></div></article>;
}

function EmptyState() {
  return <section className="mt-7 bg-white border border-slate-200 rounded-3xl p-12 text-center"><BookOpen className="w-12 h-12 text-blue-600 mx-auto" /><h2 className="text-xl font-black mt-4">Suas matérias aparecerão aqui</h2><p className="text-slate-600 mt-2">Crie um simulado para identificar e organizar automaticamente os temas do PDF.</p></section>;
}
