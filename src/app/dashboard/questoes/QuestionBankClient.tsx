'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, CheckSquare, ChevronLeft, ChevronRight, Edit3, Eye, FilePlus2, Heart, History, Loader2, Printer, Save, Search, Tags, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

interface BankQuestion {
  key: string; simuladoId: string; simuladoTitulo: string; id: number; tema: string; enunciado: string; opcoes: string[]
  respostaCorreta: string; justificativa: string; dificuldade: 'Fácil' | 'Médio' | 'Avançado'; createdAt: string; materials: string[]
  favorite: boolean; tags: string[]; notes: string; editorialStatus: string; sourceType: string; sourceName: string | null
  licenseReference: string | null; versionCount: number
}
interface Version { id: string; version: number; changeType: string; snapshotJson: string; createdAt: string }

export default function QuestionBankClient({ questions: initialQuestions }: { questions: BankQuestion[] }) {
  const router = useRouter()
  const pageSize = 8
  const [questions, setQuestions] = useState(initialQuestions)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('Todas')
  const [theme, setTheme] = useState('Todos')
  const [material, setMaterial] = useState('Todos')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [quizTitle, setQuizTitle] = useState('Simulado personalizado')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BankQuestion | null>(null)
  const [versions, setVersions] = useState<{ key: string; items: Version[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const themes = useMemo(() => [...new Set(questions.map((question) => question.tema))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions])
  const materials = useMemo(() => [...new Set(questions.flatMap((question) => question.materials))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [questions])
  const filtered = useMemo(() => questions.filter((question) => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const haystack = `${question.enunciado} ${question.justificativa} ${question.tema} ${question.simuladoTitulo} ${question.tags.join(' ')} ${question.notes}`.toLocaleLowerCase('pt-BR')
    const created = question.createdAt.slice(0, 10)
    return (!query || haystack.includes(query)) && (difficulty === 'Todas' || question.dificuldade === difficulty)
      && (theme === 'Todos' || question.tema === theme) && (material === 'Todos' || question.materials.includes(material))
      && (!fromDate || created >= fromDate) && (!toDate || created <= toDate) && (!favoritesOnly || question.favorite)
  }), [difficulty, favoritesOnly, fromDate, material, questions, search, theme, toDate])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedQuestions = questions.filter((question) => selected.includes(question.key))

  function updateLocal(key: string, changes: Partial<BankQuestion>) {
    setQuestions((current) => current.map((question) => question.key === key ? { ...question, ...changes } : question))
  }

  async function saveMetadata(question: BankQuestion, changes: { favorite?: boolean; tags?: string[]; notes?: string | null; submitForCuration?: boolean }) {
    updateLocal(question.key, changes as Partial<BankQuestion>)
    const response = await fetch(`/api/question-bank/${question.simuladoId}/${question.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
    if (!response.ok) { toast.error('Não foi possível salvar a organização da questão.'); router.refresh(); return false }
    if (changes.submitForCuration) updateLocal(question.key, { editorialStatus: 'PENDING' })
    return true
  }

  async function removeQuestion(question: BankQuestion) {
    if (!window.confirm('Remover esta questão do seu banco? O simulado e os resultados antigos serão preservados.')) return
    const response = await fetch(`/api/question-bank/${question.simuladoId}/${question.id}`, { method: 'DELETE' })
    if (!response.ok) return toast.error('Não foi possível remover a questão.')
    setQuestions((current) => current.filter((item) => item.key !== question.key)); setSelected((current) => current.filter((key) => key !== question.key)); toast.success('Questão removida do banco.')
  }

  async function createQuiz() {
    if (!selectedQuestions.length) return
    setCreating(true)
    const response = await fetch('/api/question-bank/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: quizTitle, questions: selectedQuestions.map((question) => ({ simuladoId: question.simuladoId, questionId: question.id })) }) })
    const data = await response.json(); setCreating(false)
    if (!response.ok) return toast.error(data.error || 'Não foi possível criar o simulado.')
    toast.success(`Simulado criado com ${data.questionCount} questão(ões).`); router.push(`/dashboard/simulado/${data.quizId}`)
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const response = await fetch(`/api/simulados/${editing.simuladoId}/questions/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tema: editing.tema, enunciado: editing.enunciado, opcoes: editing.opcoes, resposta_correta: editing.respostaCorreta, justificativa: editing.justificativa, dificuldade: editing.dificuldade }) })
    const data = await response.json(); setSaving(false)
    if (!response.ok) return toast.error(data.error || 'Não foi possível editar. Simulados concluídos permanecem bloqueados para preservar o resultado.')
    updateLocal(editing.key, { ...editing, opcoes: data.question.opcoes, versionCount: editing.versionCount ? editing.versionCount + 1 : 2 }); setEditing(null); toast.success('Questão editada e nova versão registrada.')
  }

  async function loadVersions(question: BankQuestion) {
    const response = await fetch(`/api/question-bank/${question.simuladoId}/${question.id}`)
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || 'Não foi possível carregar as versões.')
    setVersions({ key: question.key, items: data.versions })
  }

  function printQuestions() {
    const source = selectedQuestions.length ? selectedQuestions : filtered
    if (!source.length) return toast.error('Não há questões para imprimir.')
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Banco de questões</title><style>body{font-family:Arial;margin:32px;color:#172033}article{break-inside:avoid;border-bottom:1px solid #ccc;padding:0 0 22px;margin-bottom:22px}li{margin:7px 0}.answer{background:#eef6ff;padding:12px}</style></head><body><h1>Banco de questões</h1><p>Acervo privado de questões geradas a partir dos materiais do usuário.</p>${source.map((q, index) => `<article><h2>${index + 1}. ${escapeHtml(q.enunciado)}</h2><p>${escapeHtml(q.tema)} · ${escapeHtml(q.dificuldade)} · ${escapeHtml(q.materials.join(', '))}</p><ol type="A">${q.opcoes.map((option) => `<li>${escapeHtml(option.replace(/^[A-D]\)\s*/i, ''))}</li>`).join('')}</ol><div class="answer"><strong>Resposta: ${escapeHtml(q.respostaCorreta)}</strong><p>${escapeHtml(q.justificativa)}</p></div></article>`).join('')}<script>window.onload=()=>window.print()<\/script></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Seu acervo privado</p><h1 className="mt-2 text-3xl font-black">Banco de questões</h1><p className="mt-2 max-w-3xl text-slate-600">Reúne as questões geradas nos seus próprios simulados e materiais. Não é um catálogo de questões oficiais.</p></div><button onClick={printQuestions} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold"><Printer className="h-4 w-4" /> Imprimir</button></div>

    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="relative xl:col-span-2"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar enunciado, justificativa, tag ou anotação" className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4" /></label><Select value={difficulty} setValue={setDifficulty}><option>Todas</option><option>Fácil</option><option>Médio</option><option>Avançado</option></Select><Select value={theme} setValue={setTheme}><option>Todos</option>{themes.map((item) => <option key={item}>{item}</option>)}</Select><Select value={material} setValue={setMaterial}><option>Todos</option>{materials.map((item) => <option key={item}>{item}</option>)}</Select><label className="text-xs font-bold text-slate-600">Geradas a partir de<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-slate-600">Geradas até<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Somente favoritas</label></div></section>

    {selected.length > 0 && <section className="sticky top-3 z-20 mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#061b46] p-4 text-white shadow-xl"><CheckSquare className="h-5 w-5 text-[#ffc400]" /><strong>{selected.length} selecionada(s)</strong><input value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} className="min-w-56 flex-1 rounded-xl px-4 py-2.5 text-slate-900" /><button disabled={creating || selected.length > 50} onClick={createQuiz} className="inline-flex items-center gap-2 rounded-xl bg-[#ffc400] px-4 py-2.5 font-black text-[#06183d] disabled:opacity-50">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Montar simulado</button><button onClick={() => setSelected([])} className="p-2"><X className="h-5 w-5" /></button></section>}

    <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}</p><button onClick={() => setSelected((current) => visible.every((question) => current.includes(question.key)) ? current.filter((key) => !visible.some((question) => question.key === key)) : [...new Set([...current, ...visible.map((question) => question.key)])])} className="text-sm font-black text-blue-700">Selecionar página</button></div>

    {filtered.length ? <><section className="mt-4 grid items-start gap-4 lg:grid-cols-2">{visible.map((question) => <article key={question.key} className={`rounded-2xl border bg-white p-5 shadow-sm ${selected.includes(question.key) ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}><div className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(question.key)} onChange={() => setSelected((current) => current.includes(question.key) ? current.filter((key) => key !== question.key) : [...current, question.key])} className="mt-1 h-5 w-5" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{question.tema}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{question.dificuldade}</span>{question.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1">#{tag}</span>)}</div><h2 className="mt-4 font-black leading-relaxed">{question.enunciado}</h2></div><button title="Favoritar" onClick={() => saveMetadata(question, { favorite: !question.favorite })}><Heart className={`h-5 w-5 ${question.favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} /></button></div><details className="group mt-4"><summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><Eye className="h-4 w-4" /><span className="group-open:hidden">Ver questão completa</span><span className="hidden group-open:inline">Recolher</span></summary><div className="mt-4 space-y-3"><div className="grid gap-2">{question.opcoes.map((option) => <div key={option} className={`rounded-xl border px-4 py-2.5 text-sm ${option.startsWith(`${question.respostaCorreta})`) ? 'border-emerald-300 bg-emerald-50 font-bold' : 'border-slate-200 bg-slate-50'}`}>{option}</div>)}</div><div className="rounded-xl bg-blue-50 p-4 text-sm"><strong>Justificativa</strong><p className="mt-1 leading-relaxed">{question.justificativa}</p></div><MetadataEditor question={question} onSave={saveMetadata} /></div></details><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"><p className="mr-auto max-w-56 truncate text-xs text-slate-500" title={question.materials.join(', ')}>{question.materials.join(', ')} · {new Date(question.createdAt).toLocaleDateString('pt-BR')}</p><button onClick={() => setEditing({ ...question })} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Editar"><Edit3 className="h-4 w-4" /></button><button onClick={() => loadVersions(question)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Versões"><History className="h-4 w-4" /></button><button onClick={() => removeQuestion(question)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Remover do banco"><Trash2 className="h-4 w-4" /></button><Link href={`/dashboard/simulado/${question.simuladoId}`} className="text-sm font-black text-blue-700">Abrir simulado</Link></div></article>)}</section>{pageCount > 1 && <nav className="mt-6 flex items-center justify-center gap-3"><button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-xl border p-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-bold">Página {currentPage} de {pageCount}</span><button onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-xl border p-3 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></nav>}</> : <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-12 w-12 text-blue-600" /><h2 className="mt-4 text-xl font-black">Nenhuma questão encontrada</h2></section>}

    {editing && <EditModal question={editing} setQuestion={setEditing} onClose={() => setEditing(null)} onSave={saveEdit} saving={saving} />}
    {versions && <VersionModal data={versions} question={questions.find((question) => question.key === versions.key)} onClose={() => setVersions(null)} />}
  </div>
}

function MetadataEditor({ question, onSave }: { question: BankQuestion; onSave: (question: BankQuestion, changes: { tags?: string[]; notes?: string | null; submitForCuration?: boolean }) => Promise<boolean> }) {
  const [tags, setTags] = useState(question.tags.join(', ')); const [notes, setNotes] = useState(question.notes); const [saving, setSaving] = useState(false)
  async function save() { setSaving(true); await onSave(question, { tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), notes }); setSaving(false); toast.success('Tags e anotações salvas.') }
  return <div className="grid gap-3 rounded-xl border border-slate-200 p-4"><label className="text-xs font-bold"><Tags className="mr-1 inline h-4 w-4" /> Tags separadas por vírgula<input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2" /></label><label className="text-xs font-bold">Anotações pessoais<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border px-3 py-2" /></label><div className="flex flex-wrap gap-2"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-black text-white"><Save className="h-4 w-4" /> Salvar</button>{question.editorialStatus === 'PRIVATE' && <button onClick={() => onSave(question, { submitForCuration: true }).then((ok) => ok && toast.success('Enviada para curadoria administrativa.'))} className="rounded-lg border px-3 py-2 text-sm font-bold">Enviar para curadoria</button>}<span className="self-center text-xs text-slate-500">Status: {statusLabel(question.editorialStatus)}</span></div></div>
}

function EditModal({ question, setQuestion, onClose, onSave, saving }: { question: BankQuestion; setQuestion: (question: BankQuestion) => void; onClose: () => void; onSave: () => void; saving: boolean }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4"><div className="mx-auto my-6 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-black">Editar questão</h2><button onClick={onClose}><X /></button></div><div className="mt-5 grid gap-4"><Field label="Tema" value={question.tema} onChange={(value) => setQuestion({ ...question, tema: value })} /><label className="text-sm font-bold">Dificuldade<select value={question.dificuldade} onChange={(event) => setQuestion({ ...question, dificuldade: event.target.value as BankQuestion['dificuldade'] })} className="mt-2 w-full rounded-xl border px-4 py-3"><option>Fácil</option><option>Médio</option><option>Avançado</option></select></label><Field area label="Enunciado" value={question.enunciado} onChange={(value) => setQuestion({ ...question, enunciado: value })} />{question.opcoes.map((option, index) => <Field key={index} label={`Alternativa ${String.fromCharCode(65 + index)}`} value={option.replace(/^[A-D]\)\s*/i, '')} onChange={(value) => setQuestion({ ...question, opcoes: question.opcoes.map((item, itemIndex) => itemIndex === index ? value : item) })} />)}<label className="text-sm font-bold">Resposta correta<select value={question.respostaCorreta} onChange={(event) => setQuestion({ ...question, respostaCorreta: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3"><option>A</option><option>B</option><option>C</option><option>D</option></select></label><Field area label="Justificativa" value={question.justificativa} onChange={(value) => setQuestion({ ...question, justificativa: value })} /></div><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button onClick={onSave} disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar nova versão'}</button></div></div></div>
}

function VersionModal({ data, question, onClose }: { data: { items: Version[] }; question?: BankQuestion; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4"><div className="mx-auto my-10 max-w-2xl rounded-3xl bg-white p-6"><div className="flex justify-between"><div><h2 className="text-xl font-black">Histórico de versões</h2><p className="mt-1 text-sm text-slate-500">{question?.enunciado}</p></div><button onClick={onClose}><X /></button></div><div className="mt-5 space-y-3">{data.items.length ? data.items.map((version) => { const snapshot = JSON.parse(version.snapshotJson); const label = version.changeType === 'ORIGINAL' ? 'Versão original' : version.changeType === 'EDIT_QUESTION' ? 'Edição manual' : 'Regeneração'; return <details key={version.id} className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Versão {version.version} · {label} <span className="text-xs font-normal text-slate-500">{new Date(version.createdAt).toLocaleString('pt-BR')}</span></summary><p className="mt-3 text-sm">{snapshot.enunciado}</p></details> }) : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma edição registrada ainda.</p>}</div></div></div>
}

function Select({ value, setValue, children }: { value: string; setValue: (value: string) => void; children: React.ReactNode }) { return <select value={value} onChange={(event) => setValue(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3">{children}</select> }
function Field({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) { return <label className="text-sm font-bold">{label}{area ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border px-4 py-3" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />}</label> }
function statusLabel(status: string) { return ({ PRIVATE: 'Privada', PENDING: 'Aguardando curadoria', CURATED: 'Curada', REJECTED: 'Revisão solicitada' } as Record<string, string>)[status] || status }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char) }
