'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Search } from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('Todas');
  const [theme, setTheme] = useState('Todos');
  const themes = useMemo(() => Array.from(new Set(questions.map((question) => question.tema))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions]);
  const filtered = useMemo(() => questions.filter((question) => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${question.enunciado} ${question.tema} ${question.simuladoTitulo}`.toLocaleLowerCase('pt-BR').includes(query))
      && (difficulty === 'Todas' || question.dificuldade === difficulty)
      && (theme === 'Todos' || question.tema === theme);
  }), [difficulty, questions, search, theme]);

  return <div className="max-w-6xl mx-auto p-5 sm:p-8 pb-28"><div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Revisão centralizada</p><h1 className="text-3xl sm:text-4xl font-black mt-2">Banco de Questões</h1><p className="text-slate-600 mt-2">Pesquise e revise as questões geradas a partir dos seus materiais.</p></div>
    <section className="mt-7 bg-white border border-slate-200 rounded-2xl p-4 grid md:grid-cols-[1fr_190px_220px] gap-3"><label className="relative"><Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" /><span className="sr-only">Pesquisar questões</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar questão ou matéria..." className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-600" /></label><select aria-label="Filtrar por dificuldade" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white"><option>Todas</option><option>Fácil</option><option>Médio</option><option>Avançado</option></select><select aria-label="Filtrar por matéria" value={theme} onChange={(event) => setTheme(event.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 bg-white"><option>Todos</option>{themes.map((item) => <option key={item}>{item}</option>)}</select></section>
    <div className="flex items-center justify-between mt-5"><p className="font-bold">{filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}</p><p className="text-sm text-slate-500">O gabarito permanece protegido</p></div>
    {filtered.length ? <section className="space-y-4 mt-4">{filtered.map((question) => <article key={question.key} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1">{question.tema}</span><span className="rounded-full bg-amber-50 text-amber-800 px-3 py-1">{question.dificuldade}</span></div><h2 className="font-black text-lg mt-4">{question.enunciado}</h2><div className="grid sm:grid-cols-2 gap-2 mt-4">{question.opcoes.map((option) => <div key={option} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">{option}</div>)}</div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500 truncate">{question.simuladoTitulo}</p><Link href={`/dashboard/simulado/${question.simuladoId}`} className="shrink-0 text-sm font-black text-blue-700">Abrir simulado</Link></div></article>)}</section> : <section className="mt-5 bg-white border border-slate-200 rounded-3xl p-12 text-center"><BookOpenCheck className="w-12 h-12 text-blue-600 mx-auto" /><h2 className="font-black text-xl mt-4">Nenhuma questão encontrada</h2><p className="text-slate-600 mt-2">Ajuste os filtros ou crie seu primeiro simulado.</p></section>}
  </div>;
}
