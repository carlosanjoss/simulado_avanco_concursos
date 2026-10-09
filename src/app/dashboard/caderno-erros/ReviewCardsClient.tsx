'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, Brain, CheckCircle2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types/quiz'

interface ReviewCardView { id: string; simuladoId: string; simuladoTitulo: string; question: Question; lastAnswer: string | null; repetitions: number }

export default function ReviewCardsClient({ initialCards }: { initialCards: ReviewCardView[] }) {
  const [cards, setCards] = useState(initialCards)
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const card = cards[0]

  async function grade(quality: number) {
    if (!card) return
    setSaving(true)
    try {
      const response = await fetch('/api/review-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: card.id, quality }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setCards((current) => current.slice(1)); setRevealed(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a revisão') } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-5xl p-5 pb-24 sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Revisão espaçada</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black sm:text-4xl">Caderno de erros</h1><p className="mt-2 text-slate-600">Questões erradas retornam no momento certo para você fixar o conteúdo.</p></div><span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">{cards.length} para revisar hoje</span></div>
    {!card ? <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-4 text-2xl font-black text-emerald-900">Revisões do dia concluídas</h2><p className="mt-2 text-emerald-800">Novas questões aparecerão de acordo com seu desempenho e intervalo de revisão.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Voltar ao dashboard</Link></section> : <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-4 text-sm text-slate-500"><strong className="text-slate-800">{card.simuladoTitulo}</strong> · {card.question.tema} · {card.question.dificuldade}</div><div className="p-6 sm:p-9"><h2 className="text-xl font-black leading-relaxed sm:text-2xl">{card.question.enunciado}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{card.question.opcoes.map((option) => <div key={option} className={`rounded-xl border px-4 py-3 text-sm ${revealed && option.startsWith(`${card.question.resposta_correta})`) ? 'border-emerald-400 bg-emerald-50 font-bold text-emerald-900' : 'border-slate-200 bg-slate-50'}`}>{option}</div>)}</div>{!revealed ? <button type="button" onClick={() => setRevealed(true)} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-black text-white"><Brain className="h-5 w-5" /> Mostrar resposta</button> : <><div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="font-black text-blue-950">Resposta {card.question.resposta_correta}</p><p className="mt-2 text-sm leading-relaxed text-slate-700">{card.question.justificativa}</p>{card.lastAnswer && <p className="mt-3 text-xs text-slate-500">Sua última resposta: {card.lastAnswer}</p>}</div><p className="mt-6 text-sm font-bold text-slate-700">Como foi lembrar desta questão?</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[1,'Errei'],[3,'Difícil'],[4,'Bom'],[5,'Fácil']].map(([quality, label]) => <button key={label} disabled={saving} onClick={() => grade(Number(quality))} className="rounded-xl border border-slate-300 px-4 py-3 font-bold hover:border-blue-500 hover:text-blue-700 disabled:opacity-50">{label}</button>)}</div></>}</div><div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><span className="flex items-center gap-2 text-xs text-slate-500"><RotateCcw className="h-4 w-4" /> {card.repetitions} revisões anteriores</span><Link href={`/dashboard/simulado/${card.simuladoId}`} className="flex items-center gap-2 text-sm font-bold text-blue-700"><BookOpenCheck className="h-4 w-4" /> Abrir simulado</Link></div></section>}
  </div>
}
