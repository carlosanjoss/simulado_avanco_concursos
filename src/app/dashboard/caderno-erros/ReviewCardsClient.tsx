'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Brain, CheckCircle2, ClipboardList, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types/quiz'

interface ReviewCardView { id: string; simuladoId: string; simuladoTitulo: string; question: Question; lastAnswer: string | null; repetitions: number }

export default function ReviewCardsClient({ initialCards, pendingCount }: { initialCards: ReviewCardView[]; pendingCount: number }) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quizSize, setQuizSize] = useState<5 | 10 | 20>(10)
  const [creatingQuiz, setCreatingQuiz] = useState(false)
  const card = cards[0]

  async function createReviewQuiz() {
    setCreatingQuiz(true)
    try {
      const response = await fetch('/api/review-cards/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: quizSize }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast.success(`Revisão criada com ${data.questionCount} questão(ões).`)
      router.push(`/dashboard/simulado/${data.quizId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a revisão')
    } finally {
      setCreatingQuiz(false)
    }
  }

  async function grade(quality: number) {
    if (!card) return
    setSaving(true)
    try {
      const response = await fetch('/api/review-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: card.id, quality }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setCards((current) => current.slice(1)); setRevealed(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a revisão') } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-5xl p-4 pb-10 sm:p-6 lg:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Revisão espaçada</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black sm:text-3xl">Caderno de erros</h1><p className="mt-2 text-slate-600">Questões erradas retornam no momento certo para você fixar o conteúdo.</p></div><span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">{cards.length} para revisar hoje</span></div>
    {pendingCount > 0 && <section className="mt-7 grid gap-5 rounded-3xl bg-gradient-to-br from-[#061b46] to-[#075ed1] p-6 text-white shadow-lg sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#ffd84d]"><ClipboardList className="h-4 w-4" /> Prática personalizada</span><h2 className="mt-3 text-2xl font-black">Criar simulado com seus erros</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Reúne as revisões mais urgentes em uma sessão completa. Questões vencidas aparecem primeiro e o resultado atualiza automaticamente os próximos intervalos.</p><p className="mt-3 text-xs font-bold text-blue-200">{pendingCount} questão(ões) pendente(s) no total · não consome geração por IA</p></div><div className="flex flex-col gap-3 sm:min-w-52"><label className="text-xs font-black uppercase tracking-wider text-blue-100">Tamanho da revisão<select value={quizSize} onChange={(event) => setQuizSize(Number(event.target.value) as 5 | 10 | 20)} className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#06183d]"><option value={5}>Até 5 questões</option><option value={10}>Até 10 questões</option><option value={20}>Até 20 questões</option></select></label><button type="button" onClick={createReviewQuiz} disabled={creatingQuiz} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] transition hover:bg-yellow-300 disabled:opacity-60">{creatingQuiz ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardList className="h-5 w-5" />}{creatingQuiz ? 'Preparando...' : 'Criar revisão'}</button></div></section>}
    {!card ? <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-4 text-2xl font-black text-emerald-900">Revisões do dia concluídas</h2><p className="mt-2 text-emerald-800">Novas questões aparecerão de acordo com seu desempenho e intervalo de revisão.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Voltar ao dashboard</Link></section> : <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-4 text-sm text-slate-500"><strong className="text-slate-800">{card.simuladoTitulo}</strong> · {card.question.tema} · {card.question.dificuldade}</div><div className="p-6 sm:p-9"><h2 className="text-xl font-black leading-relaxed sm:text-2xl">{card.question.enunciado}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{card.question.opcoes.map((option) => <div key={option} className={`rounded-xl border px-4 py-3 text-sm ${revealed && option.startsWith(`${card.question.resposta_correta})`) ? 'border-emerald-400 bg-emerald-50 font-bold text-emerald-900' : 'border-slate-200 bg-slate-50'}`}>{option}</div>)}</div>{!revealed ? <button type="button" onClick={() => setRevealed(true)} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-black text-white"><Brain className="h-5 w-5" /> Mostrar resposta</button> : <><div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="font-black text-blue-950">Resposta {card.question.resposta_correta}</p><p className="mt-2 text-sm leading-relaxed text-slate-700">{card.question.justificativa}</p>{card.lastAnswer && <p className="mt-3 text-xs text-slate-500">Sua última resposta: {card.lastAnswer}</p>}</div><p className="mt-6 text-sm font-bold text-slate-700">Como foi lembrar desta questão?</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[1,'Errei'],[3,'Difícil'],[4,'Bom'],[5,'Fácil']].map(([quality, label]) => <button key={label} disabled={saving} onClick={() => grade(Number(quality))} className="rounded-xl border border-slate-300 px-4 py-3 font-bold hover:border-blue-500 hover:text-blue-700 disabled:opacity-50">{label}</button>)}</div></>}</div><div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><span className="flex items-center gap-2 text-xs text-slate-500"><RotateCcw className="h-4 w-4" /> {card.repetitions} revisões anteriores</span><Link href={`/dashboard/simulado/${card.simuladoId}`} className="flex items-center gap-2 text-sm font-bold text-blue-700"><BookOpenCheck className="h-4 w-4" /> Abrir simulado</Link></div></section>}
  </div>
}
