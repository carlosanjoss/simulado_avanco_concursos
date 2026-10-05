'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Check, ChevronRight, Clock3, Flame, RefreshCw, Sparkles, Target, Trophy } from 'lucide-react';

const dayNames = ['Hoje', 'Amanhã', 'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6', 'Dia 7'];
const activityLabels = ['Revisão ativa', 'Prática dirigida', 'Fixação'];

interface PlanTask { id: string; day: string; title: string; detail: string; duration: number; mode: string }

export default function StudyPlanClient({ themes }: { themes: string[] }) {
  const planThemes = useMemo(() => themes.length ? themes : ['Fundamentos', 'Revisão geral', 'Prática de questões'], [themes]);
  const tasks = useMemo<PlanTask[]>(() => dayNames.map((day, index) => {
    const theme = planThemes[index % planThemes.length];
    const mode = index % 3;
    return {
      id: `${index}-${theme}`,
      day,
      title: mode === 0 ? `Revisar ${theme}` : mode === 1 ? `Praticar ${theme}` : `Consolidar ${theme}`,
      detail: mode === 0 ? 'Leitura ativa e anotações dos conceitos centrais.' : mode === 1 ? 'Resolva questões e registre os pontos de atenção.' : 'Explique o conteúdo sem consultar o material.',
      duration: mode === 1 ? 30 : 25,
      mode: activityLabels[mode],
    };
  }), [planThemes]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setCompleted(JSON.parse(localStorage.getItem('avanco-study-plan') || '[]')); } catch { setCompleted([]); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem('avanco-study-plan', JSON.stringify(completed)); }, [completed, loaded]);

  const percentage = Math.round((completed.length / tasks.length) * 100);
  const remaining = tasks.length - completed.length;
  const toggle = (id: string) => setCompleted((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-7 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Sua semana de estudos</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Plano de Estudos</h1><p className="mt-2 max-w-2xl text-slate-600">Uma rotina prática criada a partir dos temas dos seus simulados.</p></div>
        <button type="button" onClick={() => setCompleted([])} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black shadow-sm transition hover:border-blue-300 hover:text-blue-700 sm:self-auto"><RefreshCw className="h-4 w-4" /> Reiniciar semana</button>
      </div>

      <section className="relative mt-7 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#061b46] via-[#07347d] to-[#075ed1] p-6 text-white shadow-[0_20px_60px_rgba(6,41,104,0.22)] sm:p-8">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-2xl" /><div className="absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-[#ffc400]/15 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_330px] lg:items-center">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-[#ffd84d]"><Flame className="h-4 w-4" /> Consistência cria resultado</span><h2 className="mt-4 text-2xl font-black sm:text-3xl">Seu progresso desta semana</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">Avance uma atividade por dia. Se perder um dia, continue de onde parou — o importante é manter o ritmo.</p>
            <div className="mt-6 flex gap-2" aria-label={`${completed.length} de ${tasks.length} atividades concluídas`}>{tasks.map((task, index) => <span key={task.id} className={`h-2.5 flex-1 rounded-full transition-colors ${completed.includes(task.id) ? 'bg-[#ffc400]' : index === completed.length ? 'bg-white' : 'bg-white/20'}`} />)}</div>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-5 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(#ffc400 ${percentage * 3.6}deg, rgba(255,255,255,.16) 0deg)` }}><div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#09275b] text-2xl font-black">{percentage}%</div></div>
            <div><p className="text-3xl font-black">{completed.length}<span className="text-lg text-blue-200">/{tasks.length}</span></p><p className="mt-1 text-sm text-blue-100">atividades concluídas</p><p className="mt-3 text-xs font-bold text-[#ffd84d]">{remaining === 0 ? 'Semana concluída!' : `${remaining} para concluir`}</p></div>
          </div>
        </div>
      </section>

      <div className="mt-7 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="min-w-0"><h2 className="text-xl font-black">Roteiro de 7 dias</h2><p className="mt-1 text-sm text-slate-500">Clique em uma atividade para marcá-la como concluída.</p></div><BookOpenCheck className="h-6 w-6 shrink-0 text-blue-700" /></div>
          <div className="divide-y divide-slate-100">{tasks.map((task, index) => { const done = completed.includes(task.id); return (
            <button key={task.id} type="button" onClick={() => toggle(task.id)} aria-pressed={done} className={`group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors sm:px-6 ${done ? 'bg-emerald-50/60' : 'hover:bg-blue-50/50'}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black transition-all ${done ? 'bg-emerald-600 text-white' : index === completed.length ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-slate-100 text-slate-500'}`}>{done ? <Check className="h-5 w-5" /> : index + 1}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className={`text-xs font-black uppercase tracking-wider ${done ? 'text-emerald-700' : 'text-blue-700'}`}>{task.day}</p><span className="text-xs font-semibold text-slate-400">{task.mode}</span></div><h3 className={`mt-1 font-black sm:text-lg ${done ? 'text-slate-500 line-through' : 'text-[#07183b]'}`}>{task.title}</h3><p className="mt-1 text-sm text-slate-500">{task.detail}</p></div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 sm:flex"><Clock3 className="h-4 w-4" /> {task.duration} min</span><ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
            </button>
          )})}</div>
        </section>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Target className="h-6 w-6" /></span><h2 className="mt-4 text-xl font-black">Foco da semana</h2><p className="mt-1 text-sm text-slate-500">Temas mais recorrentes nos seus simulados.</p><div className="mt-5 space-y-3">{planThemes.slice(0, 4).map((theme, index) => <div key={theme} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700">{index + 1}</span><p className="min-w-0 truncate text-sm font-bold">{theme}</p></div>)}</div></section>
          <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6"><Sparkles className="h-6 w-6 text-blue-700" /><h2 className="mt-3 font-black">Pronto para praticar?</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">Gere um novo simulado e atualize seu plano com conteúdos recentes.</p><Link href="/dashboard/novo" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-4 py-3 font-black text-[#06183d] shadow-sm transition hover:bg-yellow-300">Criar simulado <ChevronRight className="h-4 w-4" /></Link></section>
          {percentage === 100 && <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white"><Trophy className="h-7 w-7 text-[#ffd84d]" /><div><p className="font-black">Semana concluída</p><p className="text-xs text-emerald-100">Ótimo trabalho. Continue assim!</p></div></div>}
        </aside>
      </div>
    </div>
  );
}
