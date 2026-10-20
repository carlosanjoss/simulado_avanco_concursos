'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BookOpenCheck, Brain, CalendarDays, CheckCircle2, ClipboardList, Heart, Loader2, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types/quiz'

type ErrorType = 'CONTENT' | 'ATTENTION' | 'DOUBT'
interface ReviewCardView {
  id: string; simuladoId: string; simuladoTitulo: string; question: Question; lastAnswer: string | null
  repetitions: number; intervalDays: number; easeFactor: number; dueAt: string; lastReviewedAt: string | null
  retention: number; notes: string | null; favorite: boolean; errorType: ErrorType; manual: boolean; lapses: number
}
interface Candidate { simuladoId: string; simuladoTitulo: string; questionId: number; theme: string; difficulty: string; statement: string }

const errorLabels: Record<ErrorType, string> = { CONTENT: 'Erro de conteúdo', ATTENTION: 'Desatenção', DOUBT: 'Dúvida' }

export default function ReviewCardsClient({ initialCards, candidates }: { initialCards: ReviewCardView[]; candidates: Candidate[] }) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [activeId, setActiveId] = useState(initialCards[0]?.id || '')
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingQuiz, setCreatingQuiz] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [candidateKey, setCandidateKey] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [quizSize, setQuizSize] = useState<5 | 10 | 20>(10)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState('ALL')
  const [difficulty, setDifficulty] = useState('ALL')
  const [dueFilter, setDueFilter] = useState<'ALL' | 'DUE' | 'FUTURE'>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | ErrorType>('ALL')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const now = Date.now()

  const themes = useMemo(() => [...new Set(cards.map((card) => card.question.tema))].sort(), [cards])
  const filteredCards = useMemo(() => cards.filter((card) => {
    const text = `${card.question.tema} ${card.question.enunciado} ${card.simuladoTitulo}`.toLocaleLowerCase('pt-BR')
    const overdue = new Date(card.dueAt).getTime() <= now
    return (!search || text.includes(search.toLocaleLowerCase('pt-BR'))) && (theme === 'ALL' || card.question.tema === theme)
      && (difficulty === 'ALL' || card.question.dificuldade === difficulty) && (typeFilter === 'ALL' || card.errorType === typeFilter)
      && (!favoritesOnly || card.favorite) && (dueFilter === 'ALL' || (dueFilter === 'DUE' ? overdue : !overdue))
  }), [cards, difficulty, dueFilter, favoritesOnly, now, search, theme, typeFilter])
  const active = filteredCards.find((card) => card.id === activeId) || filteredCards[0]
  const dueCount = cards.filter((card) => new Date(card.dueAt).getTime() <= now).length
  const filteredCandidates = candidates.filter((candidate) => `${candidate.simuladoTitulo} ${candidate.theme} ${candidate.statement}`.toLocaleLowerCase('pt-BR').includes(candidateSearch.toLocaleLowerCase('pt-BR'))).slice(0, 80)
  const calendar = useMemo(() => Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + offset)
    const end = new Date(day); end.setDate(end.getDate() + 1)
    return { date: day, count: cards.filter((card) => { const due = new Date(card.dueAt); return due >= day && due < end }).length }
  }), [cards])

  async function createReviewQuiz() {
    setCreatingQuiz(true)
    try {
      const response = await fetch('/api/review-cards/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: quizSize, theme: theme === 'ALL' ? undefined : theme, difficulty: difficulty === 'ALL' ? undefined : difficulty, errorType: typeFilter === 'ALL' ? undefined : typeFilter, favoritesOnly, dueOnly: dueFilter === 'DUE' }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      toast.success(`Revisão criada com ${data.questionCount} questão(ões).`); router.push(`/dashboard/simulado/${data.quizId}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar a revisão') } finally { setCreatingQuiz(false) }
  }

  async function grade(quality: number) {
    if (!active) return
    setSaving(true)
    try {
      const response = await fetch('/api/review-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'grade', cardId: active.id, quality }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setCards((current) => data.mastered
        ? current.filter((card) => card.id !== active.id)
        : current.map((card) => card.id === active.id ? { ...card, dueAt: data.dueAt, retention: data.retention, repetitions: data.repetitions, intervalDays: data.intervalDays, easeFactor: data.easeFactor, lapses: data.lapses, lastReviewedAt: new Date().toISOString() } : card))
      setActiveId(''); setRevealed(false)
      toast.success(data.mastered ? 'Questão dominada.' : 'Próxima revisão agendada.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a revisão') } finally { setSaving(false) }
  }

  async function updateCard(cardId: string, changes: Partial<Pick<ReviewCardView, 'notes' | 'favorite' | 'errorType'>>) {
    setCards((current) => current.map((card) => card.id === cardId ? { ...card, ...changes } : card))
    const response = await fetch('/api/review-cards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId, ...changes }) })
    if (!response.ok) { toast.error('Não foi possível salvar a alteração.'); router.refresh() }
  }

  async function addManual() {
    const candidate = candidates.find((item) => `${item.simuladoId}:${item.questionId}` === candidateKey)
    if (!candidate) return
    setSaving(true)
    const response = await fetch('/api/review-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', simuladoId: candidate.simuladoId, questionId: candidate.questionId, errorType: 'DOUBT' }) })
    const data = await response.json(); setSaving(false)
    if (!response.ok) return toast.error(data.error || 'Não foi possível adicionar a questão.')
    toast.success('Questão adicionada ao caderno.'); setShowAdd(false); router.refresh()
  }

  async function removeCard(cardId: string) {
    const response = await fetch(`/api/review-cards?cardId=${encodeURIComponent(cardId)}`, { method: 'DELETE' })
    if (!response.ok) return toast.error('Não foi possível remover a questão.')
    setCards((current) => current.filter((card) => card.id !== cardId)); toast.success('Questão removida do caderno.')
  }

  return <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Revisão adaptativa</p><h1 className="mt-2 text-3xl font-black">Caderno de erros</h1><p className="mt-2 text-slate-600">Organize suas dificuldades e revise cada questão no momento ideal.</p></div><button onClick={() => setShowAdd((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white"><Plus className="h-5 w-5" /> Adicionar questão</button></div>

    {dueCount > 0 && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><Bell className="h-5 w-5" /><strong>{dueCount} revisão(ões) vencida(s) aguardando você.</strong></div>}

    {showAdd && <section className="mt-5 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Adicionar questão manualmente</h2><p className="mt-1 text-sm text-slate-500">Escolha uma questão já existente em seus simulados. Ela será marcada como favorita e ficará disponível hoje.</p><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr_auto]"><input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Buscar por tema ou enunciado" className="rounded-xl border border-slate-300 px-4 py-3" /><select value={candidateKey} onChange={(event) => setCandidateKey(event.target.value)} className="min-w-0 rounded-xl border border-slate-300 px-4 py-3"><option value="">Selecione uma questão</option>{filteredCandidates.map((candidate) => <option key={`${candidate.simuladoId}:${candidate.questionId}`} value={`${candidate.simuladoId}:${candidate.questionId}`}>{candidate.theme} · {candidate.difficulty} · {candidate.statement.slice(0, 85)}</option>)}</select><button disabled={!candidateKey || saving} onClick={addManual} className="rounded-xl bg-[#061b46] px-5 py-3 font-black text-white disabled:opacity-50">Adicionar</button></div></section>}

    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="relative xl:col-span-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no caderno" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3" /></label><Filter value={theme} onChange={setTheme}><option value="ALL">Todas as matérias</option>{themes.map((item) => <option key={item}>{item}</option>)}</Filter><Filter value={difficulty} onChange={setDifficulty}><option value="ALL">Dificuldade</option><option>Fácil</option><option>Médio</option><option>Avançado</option></Filter><Filter value={dueFilter} onChange={(value) => setDueFilter(value as typeof dueFilter)}><option value="ALL">Todos os prazos</option><option value="DUE">Vencidas</option><option value="FUTURE">Futuras</option></Filter><Filter value={typeFilter} onChange={(value) => setTypeFilter(value as typeof typeFilter)}><option value="ALL">Todos os motivos</option>{Object.entries(errorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Filter></div><label className="mt-3 inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Somente favoritas</label></section>

    <section className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="No caderno" value={cards.length} /><Metric label="Vencidas" value={dueCount} /><Metric label="Favoritas" value={cards.filter((card) => card.favorite).length} /><Metric label="Retenção média" value={`${cards.length ? Math.round(cards.reduce((sum, card) => sum + card.retention, 0) / cards.length) : 0}%`} /></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[330px_1fr]"><aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Questões ({filteredCards.length})</h2></div><div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">{filteredCards.map((card) => <button key={card.id} onClick={() => { setActiveId(card.id); setRevealed(false) }} className={`w-full p-4 text-left ${active?.id === card.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-black text-blue-700">{card.question.tema}</span>{card.favorite && <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />}</div><p className="mt-2 line-clamp-2 text-sm font-bold">{card.question.enunciado}</p><p className="mt-2 text-xs text-slate-500">{new Date(card.dueAt).getTime() <= now ? 'Revisão vencida' : `Revisar em ${new Date(card.dueAt).toLocaleDateString('pt-BR')}`} · retenção {card.retention}%</p></button>)}{!filteredCards.length && <p className="p-6 text-sm text-slate-500">Nenhuma questão corresponde aos filtros.</p>}</div></aside>

      <main>{!active ? <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-4 text-2xl font-black text-emerald-900">Nada pendente neste filtro</h2><p className="mt-2 text-emerald-800">Ajuste os filtros ou adicione uma questão manualmente.</p></section> : <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4"><span className="text-sm text-slate-500"><strong className="text-slate-800">{active.simuladoTitulo}</strong> · {active.question.dificuldade}</span><div className="flex gap-2"><button title="Favoritar" onClick={() => updateCard(active.id, { favorite: !active.favorite })} className="rounded-lg border border-slate-200 p-2"><Heart className={`h-5 w-5 ${active.favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} /></button><button title="Remover" onClick={() => removeCard(active.id)} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-5 w-5" /></button></div></div><div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-wider text-blue-700">{active.question.tema}</p><h2 className="mt-3 text-xl font-black leading-relaxed sm:text-2xl">{active.question.enunciado}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{active.question.opcoes.map((option) => <div key={option} className={`rounded-xl border px-4 py-3 text-sm ${revealed && option.startsWith(`${active.question.resposta_correta})`) ? 'border-emerald-400 bg-emerald-50 font-bold text-emerald-900' : 'border-slate-200 bg-slate-50'}`}>{option}</div>)}</div>{!revealed ? <button onClick={() => setRevealed(true)} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-black text-white"><Brain className="h-5 w-5" /> Mostrar resposta</button> : <><div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="font-black text-blue-950">Resposta {active.question.resposta_correta}</p><p className="mt-2 text-sm leading-relaxed text-slate-700">{active.question.justificativa}</p>{active.lastAnswer && <p className="mt-3 text-xs text-slate-500">Sua última resposta: {active.lastAnswer}</p>}</div><p className="mt-6 text-sm font-bold">Como foi lembrar desta questão?</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[1, 'Errei'], [3, 'Difícil'], [4, 'Bom'], [5, 'Fácil']].map(([quality, label]) => <button key={label} disabled={saving} onClick={() => grade(Number(quality))} className="rounded-xl border border-slate-300 px-4 py-3 font-bold hover:border-blue-500 hover:text-blue-700 disabled:opacity-50">{label}</button>)}</div></>}</div><div className="grid gap-4 border-t border-slate-100 bg-slate-50 p-6 md:grid-cols-2"><label className="text-sm font-bold">Motivo do erro<select value={active.errorType} onChange={(event) => updateCard(active.id, { errorType: event.target.value as ErrorType })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3">{Object.entries(errorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold">Anotações pessoais<textarea value={active.notes || ''} onChange={(event) => setCards((current) => current.map((card) => card.id === active.id ? { ...card, notes: event.target.value } : card))} onBlur={() => updateCard(active.id, { notes: active.notes })} rows={3} placeholder="Registre o que confundiu você..." className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label><div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 md:col-span-2"><span className="flex items-center gap-1"><RotateCcw className="h-4 w-4" /> {active.repetitions} revisões · {active.lapses} recaídas</span><span>Retenção estimada: <strong>{active.retention}%</strong></span><Link href={`/dashboard/simulado/${active.simuladoId}`} className="ml-auto flex items-center gap-2 font-bold text-blue-700"><BookOpenCheck className="h-4 w-4" /> Abrir simulado</Link></div></div></section>}</main></div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]"><section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-700" /><h2 className="font-black">Próximas revisões</h2></div><div className="mt-4 grid grid-cols-7 gap-2">{calendar.map(({ date, count }) => <div key={date.toISOString()} className={`rounded-xl p-2 text-center ${count ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-400'}`}><p className="text-[10px] font-bold uppercase">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</p><p className="mt-1 font-black">{date.getDate()}</p><p className="text-[10px]">{count || '—'}</p></div>)}</div></section><section className="rounded-3xl bg-[#061b46] p-6 text-white"><ClipboardList className="h-6 w-6 text-[#ffc400]" /><h2 className="mt-3 text-xl font-black">Simulado de revisão</h2><p className="mt-2 text-sm text-blue-100">Usa os filtros atuais e não consome tokens nem geração por IA.</p><select value={quizSize} onChange={(event) => setQuizSize(Number(event.target.value) as 5 | 10 | 20)} className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-black text-[#06183d]"><option value={5}>Até 5 questões</option><option value={10}>Até 10 questões</option><option value={20}>Até 20 questões</option></select><button onClick={createReviewQuiz} disabled={creatingQuiz || !filteredCards.length} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] disabled:opacity-50">{creatingQuiz ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Criar revisão</button></section></div>
  </div>
}

function Filter({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold">{children}</select>
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-2xl font-black">{value}</p><p className="text-sm text-slate-500">{label}</p></article>
}
