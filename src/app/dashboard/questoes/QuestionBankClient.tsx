'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, ChevronLeft, ChevronRight, Eye, Search } from 'lucide-react';

interface BankQuestion {
  key: string;
  simuladoId: string;
  simuladoTitulo: string;
  id: number;
  tema: string;
  enunciado: string;
  opcoes: string[];
  dificuldade: 'Fácil' | 'Médio' | 'Avançado';
}

export default function QuestionBankClient({ questions }: { questions: BankQuestion[] }) {
  const pageSize = 6;
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('Todas');
  const [theme, setTheme] = useState('Todos');
  const [page, setPage] = useState(1);
  const themes = useMemo(() => Array.from(new Set(questions.map((question) => question.tema))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions]);
  const filtered = useMemo(() => questions.filter((question) => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${question.enunciado} ${question.tema} ${question.simuladoTitulo}`.toLocaleLowerCase('pt-BR').includes(query))
      && (difficulty === 'Todas' || question.dificuldade === difficulty)
      && (theme === 'Todos' || question.tema === theme);
  }), [difficulty, questions, search, theme]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleQuestions = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisible = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(currentPage * pageSize, filtered.length);
  const changePage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(pageCount, nextPage)));
    requestAnimationFrame(() => document.getElementById('question-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return <div className="mx-auto max-w-6xl p-4 pb-10 sm:p-6 lg:p-7"><div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Revisão centralizada</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Banco de questões</h1><p className="text-slate-600 mt-2">Pesquise e revise as questões geradas a partir dos seus materiais.</p></div>
    <section className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_190px_220px]"><label className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" /><span className="sr-only">Pesquisar questões</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar questão ou matéria..." className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-600" /></label><select aria-label="Filtrar por dificuldade" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3"><option>Todas</option><option>Fácil</option><option>Médio</option><option>Avançado</option></select><select aria-label="Filtrar por matéria" value={theme} onChange={(event) => { setTheme(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3"><option>Todos</option>{themes.map((item) => <option key={item}>{item}</option>)}</select></section>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}{filtered.length > pageSize && <span className="ml-2 text-sm font-normal text-slate-500">· mostrando {firstVisible}–{lastVisible}</span>}</p><p className="text-sm text-slate-500">Alternativas recolhidas para facilitar a navegação</p></div>
    {filtered.length ? <>
      <section id="question-results" className="mt-4 grid scroll-mt-4 items-start gap-4 lg:grid-cols-2">{visibleQuestions.map((question) => <article key={question.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{question.tema}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{question.dificuldade}</span></div><h2 className="mt-4 line-clamp-3 font-black leading-relaxed" title={question.enunciado}>{question.enunciado}</h2><details className="group mt-4"><summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"><Eye className="h-4 w-4" /><span className="group-open:hidden">Ver alternativas</span><span className="hidden group-open:inline">Ocultar alternativas</span></summary><div className="mt-3 grid gap-2">{question.opcoes.map((option) => <div key={option} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">{option}</div>)}</div></details><div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="truncate text-xs text-slate-500">{question.simuladoTitulo}</p><Link href={`/dashboard/simulado/${question.simuladoId}`} className="shrink-0 text-sm font-black text-blue-700">Abrir simulado</Link></div></article>)}</section>
      {pageCount > 1 && <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginação do banco de questões"><button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button><span className="min-w-24 text-center text-sm font-bold text-slate-600">Página {currentPage} de {pageCount}</span><button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button></nav>}
    </> : <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-12 w-12 text-blue-600" /><h2 className="mt-4 text-xl font-black">Nenhuma questão encontrada</h2><p className="mt-2 text-slate-600">Ajuste os filtros ou crie seu primeiro simulado.</p></section>}
  </div>;
}
