'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, Clock3, FilePlus2, FileText, Play, RefreshCw, Target, MessageSquareWarning } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardShell from '../../components/dashboard/DashboardShell';

interface Simulado {
  id: string;
  titulo: string;
  totalQuestoes: number;
  temasFoco: string | null;
  pdfNome: string;
  status: string;
  createdAt: string;
  tentativa: { pontuacao: number; percentual: number; concluidoEm: string | null; currentIndex: number } | null;
}

interface DashboardClientProps {
  simulados: Simulado[];
  stats: { completed: number; average: number; answered: number; remaining: number | null; used: number; unlimited: boolean };
  isAdmin: boolean;
}

function getQuestionText(simulado: Simulado, completed: boolean, inProgress: boolean): string {
  const base = `${simulado.totalQuestoes} questoes `;
  if (completed) {
    return base + `Concluido em ${format(new Date(simulado.tentativa!.concluidoEm!), 'dd/MM/yyyy', { locale: ptBR })}`;
  }
  if (inProgress) {
    return base + `Em andamento - questao ${(simulado.tentativa?.currentIndex || 0) + 1}`;
  }
  return base + `Criado em ${format(new Date(simulado.createdAt), 'dd/MM/yyyy', { locale: ptBR })}`;
}

export default function DashboardClient({ simulados, stats, isAdmin }: DashboardClientProps) {
  const { user } = useUser();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchFeedbacks();
    }
  }, [isAdmin]);

  const fetchFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const res = await fetch('/api/admin/feedbacks');
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
      }
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const statCards = [
    { label: 'Simulados realizados', value: stats.completed, icon: FileText, color: 'text-blue-700 bg-blue-50' },
    { label: 'Media de acertos', value: `${stats.average}%`, icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Questoes respondidas', value: stats.answered, icon: Target, color: 'text-amber-600 bg-amber-50' },
    { label: 'Disponíveis no mês', value: stats.unlimited ? 'Ilimitado' : `${stats.remaining} de 2`, icon: Clock3, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <DashboardShell>
      <div className="p-5 sm:p-8 pb-24 max-w-[1500px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#06183d]">Ola, {user?.firstName || 'Estudante'}! <span aria-hidden>👋</span></h1>
            <p className="text-slate-500 mt-1">Continue sua jornada de estudos. Cada questao e um passo adiante.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 min-w-[220px]">
            <div className="relative w-12 h-12 rounded-full border-[5px] border-slate-100">
              <span className="absolute inset-[-5px] rounded-full border-[5px] border-emerald-500 border-l-transparent" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Limite diario</p>
              {stats.unlimited ? (
                <>
                  <p className="font-black">Geracoes ilimitadas</p>
                  <p className="text-xs text-slate-500">Conta de testes</p>
                </>
              ) : (
                <>
                  <p className="font-black">{stats.used} de 2 simulados</p>
                  <p className="text-xs text-slate-500">{stats.remaining} restante{stats.remaining === 1 ? '' : 's'} neste mês</p>
                </>
              )}
            </div>
          </div>
        </div>

        <section id="estatisticas" className="scroll-margin-top-20 grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <span className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </span>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="relative mt-6 overflow-hidden rounded-3xl avanco-navy text-white min-h-[210px] px-7 sm:px-10 py-8 flex items-center avanco-grid">
          <div className="relative z-10 max-w-xl">
            <p className="text-[#ffc400] uppercase tracking-widest text-xs font-bold">Pratique com seu proprio material</p>
            <h2 className="text-3xl sm:text-4xl font-black mt-2">Crie um novo simulado</h2>
            <p className="text-blue-100 mt-2">Envie seu PDF e receba 30 questoes personalizadas em poucos minutos.</p>
            <Link href="/dashboard/novo" className="inline-flex items-center gap-2 bg-[#ffc400] text-[#06183d] rounded-xl px-6 py-3 font-black mt-6 hover:bg-yellow-300">
              <FilePlus2 className="w-5 h-5" /> Novo Simulado
            </Link>
          </div>
          <Image src="/images/quiz-study.png" alt="Notebook com simulado" width={650} height={490} className="hidden md:block absolute right-[-25px] bottom-[-115px] w-[440px] h-auto opacity-95" />
        </section>

        <section id="historico" className="scroll-margin-top-20 mt-6 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Seus ultimos simulados</h2>
              <p className="text-sm text-slate-500">Historico real das suas atividades</p>
            </div>
            <span className="text-sm text-blue-700 font-semibold">{simulados.length} no total</span>
          </div>
          {simulados.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <span className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </span>
              <h3 className="text-xl font-black mt-5">Seu historico comeca aqui</h3>
              <p className="text-slate-500 mt-2">Envie um PDF para criar seu primeiro simulado.</p>
              <Link href="/dashboard/novo" className="inline-flex items-center gap-2 mt-5 text-blue-700 font-bold">
                Criar agora <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">{simulados.map((simulado) => <HistoryRow key={simulado.id} simulado={simulado} />)}</div>
          )}
        </section>

        {isAdmin && (
          <section id="feedbacks" className="scroll-margin-top-20 mt-6 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Feedbacks de Questoes</h2>
                <p className="text-sm text-slate-500">Relatos enviados pelos usuarios sobre questoes</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm font-semibold text-slate-600">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Simulado</th>
                    <th className="px-4 py-3">Questao</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Mensagem</th>
                    <th className="px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFeedbacks ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Carregando feedbacks...
                      </td>
                    </tr>
                  ) : feedbacks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhum feedback reportado ainda.
                      </td>
                    </tr>
                  ) : (
                    feedbacks.map((feedback) => (
                      <tr key={feedback.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            {feedback.user?.imageUrl && (
                              <Image
                                src={feedback.user.imageUrl}
                                alt=""
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full"
                              />
                            )}
                            <div>
                              <p className="font-medium">{feedback.user?.name || 'Usuario'}</p>
                              <p className="text-xs text-slate-500">{feedback.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="font-medium truncate max-w-[200px]">{feedback.simulado?.titulo}</p>
                          <p className="text-xs text-slate-500">{feedback.simulado?.pdfNome}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">#{feedback.questaoId}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            feedback.type === 'incorrect_answer' ? 'bg-red-100 text-red-700' :
                            feedback.type === 'unclear' ? 'bg-amber-100 text-amber-700' :
                            feedback.type === 'not_in_document' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {feedback.type === 'incorrect_answer' && 'Resposta incorreta'}
                            {feedback.type === 'unclear' && 'Incompreensivel'}
                            {feedback.type === 'not_in_document' && 'Nao esta no documento'}
                            {feedback.type === 'other' && 'Outro'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="truncate max-w-[300px] text-slate-700">
                            {feedback.message || 'Sem mensagem'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {new Date(feedback.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function HistoryRow({ simulado }: { simulado: Simulado }) {
  const completed = simulado.status === 'CONCLUIDO';
  const inProgress = simulado.status === 'EM_ANDAMENTO';
  return (
    <article className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-slate-50 transition-colors">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${completed ? 'bg-emerald-50 text-emerald-600' : inProgress ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'}`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-extrabold truncate">{simulado.titulo}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {getQuestionText(simulado, completed, inProgress)}
        </p>
      </div>
      <span className={`self-start lg:self-auto px-3 py-1.5 rounded-lg text-sm font-black ${completed ? 'bg-emerald-50 text-emerald-700' : inProgress ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
        {completed ? `${Math.round(simulado.tentativa?.percentual || 0)}%` : inProgress ? 'Em andamento' : 'Nao iniciado'}
      </span>
      <div className="flex flex-wrap gap-2">
        {completed && (
          <Link href={`/dashboard/simulado/${simulado.id}`} className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold hover:border-blue-500 hover:text-blue-700">
            <FileText className="w-4 h-4" /> Ver resultado
          </Link>
        )}
        <Link href={`/dashboard/simulado/${simulado.id}${completed ? '?retake=1' : ''}`} className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold hover:border-blue-500 hover:text-blue-700">
          {completed ? (
            <>
              <RefreshCw className="w-4 h-4" /> Refazer
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> {inProgress ? 'Continuar' : 'Iniciar'}
            </>
          )}
        </Link>
      </div>
    </article>
  );
}
