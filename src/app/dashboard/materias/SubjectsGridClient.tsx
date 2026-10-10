'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'

type Subject = { label: string; questions: number; simulations: number; latestQuizId: string }

export default function SubjectsGridClient({ subjects }: { subjects: Subject[] }) {
  const [page, setPage] = useState(1)
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(subjects.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleSubjects = subjects.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return <>
    <div className="mt-7 flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-600">{subjects.length} {subjects.length === 1 ? 'matéria identificada' : 'matérias identificadas'}</p>{pageCount > 1 && <p className="text-sm text-slate-500">Página {currentPage} de {pageCount}</p>}</div>
    <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSubjects.map((subject, index) => <article key={subject.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BookOpen className="h-5 w-5" /></span><span className="text-xs font-bold text-slate-500">{String((currentPage - 1) * pageSize + index + 1).padStart(2, '0')}</span></div><h2 className="mt-4 line-clamp-2 text-lg font-black" title={subject.label}>{subject.label}</h2><p className="mt-1 text-sm text-slate-600">{subject.questions} questões em {subject.simulations} simulado{subject.simulations === 1 ? '' : 's'}</p><Link href={`/dashboard/simulado/${subject.latestQuizId}`} className="mt-5 inline-flex items-center gap-1 text-sm font-black text-blue-700">Estudar matéria <ChevronRight className="h-4 w-4" /></Link></article>)}</section>
    {pageCount > 1 && <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginação de matérias"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button><span className="text-sm font-bold text-slate-600">{currentPage} de {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button></nav>}
  </>
}
