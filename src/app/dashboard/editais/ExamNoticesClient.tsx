'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, CalendarDays, ChevronDown, FileSearch, Layers3, Loader2, Plus, Search, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

interface Topic { id: string; subject: string; title: string; questionCount: number; answeredCount: number; accuracy: number | null; studied: boolean; materials: string[] }
interface Notice { id: string; title: string; examDate: string | null; sourceFileName: string | null; active: boolean; progress: number; missingMaterials: number; warnings: string[]; sections: Array<{ id: string; title: string; topics: Topic[] }> }

async function extractPdfText(file: File, onProgress: (message: string) => void) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress(`Lendo página ${pageNumber} de ${pdf.numPages}...`)
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pages.join('\n')
}

export default function ExamNoticesClient() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [topicQuery, setTopicQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/exam-notices')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar editais')
      setNotices(data.notices || [])
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao carregar editais') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const active = useMemo(() => notices.find((notice) => notice.active) || notices[0], [notices])
  const activeTopicCount = useMemo(() => active?.sections.reduce((sum, section) => sum + section.topics.length, 0) || 0, [active])
  const searchResultCount = useMemo(() => {
    if (!active) return 0
    const query = topicQuery.trim().toLocaleLowerCase('pt-BR')
    if (!query) return activeTopicCount
    return active.sections.reduce((sum, section) => sum + section.topics.filter((topic) => `${section.title} ${topic.subject} ${topic.title}`.toLocaleLowerCase('pt-BR').includes(query)).length, 0)
  }, [active, activeTopicCount, topicQuery])

  const save = async () => {
    if (!title.trim()) return toast.error('Informe o nome do concurso ou edital.')
    setSaving(true)
    try {
      let extracted = text.trim()
      if (file) extracted = await extractPdfText(file, setProgress)
      if (extracted.length < 30) throw new Error('Envie um PDF com texto selecionável ou cole o conteúdo programático.')
      setProgress('Organizando disciplinas e assuntos...')
      const response = await fetch('/api/exam-notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), examDate: examDate || null, sourceFileName: file?.name || null, text: extracted }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao analisar o edital')
      toast.success(`${data.topicCount} tópicos identificados sem nova chamada de IA.`)
      setTitle(''); setExamDate(''); setFile(null); setText(''); setShowForm(false)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao analisar o edital') }
    finally { setSaving(false); setProgress('') }
  }

  const update = async (id: string, action: 'activate' | 'remove') => {
    const response = await fetch('/api/exam-notices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: action === 'activate' || undefined, remove: action === 'remove' || undefined }) })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || 'Não foi possível atualizar o edital.')
    await load()
  }

  return <div className="mx-auto max-w-7xl p-4 pb-12 sm:p-6 lg:p-8">
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071a42] via-[#0b3274] to-blue-600 px-6 py-7 text-white shadow-xl shadow-blue-950/10 sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200"><Layers3 className="h-4 w-4 text-[#ffc400]" /> Planejamento Pro</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Meus editais</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-blue-100">Pesquise rapidamente disciplinas, regras, datas e qualquer informação dentro dos seus editais.</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] shadow-lg transition hover:-translate-y-0.5 hover:bg-yellow-300"><Plus className="h-5 w-5" /> {showForm ? 'Fechar formulário' : 'Adicionar edital'}</button>
      </div>
    </section>

    {showForm && <section className="mt-5 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div><h2 className="text-xl font-black">Adicionar edital</h2><p className="mt-1 text-sm text-slate-500">Envie o arquivo completo ou cole apenas o conteúdo programático.</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Concurso ou cargo<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: Analista do TRT" /></label><label className="text-sm font-bold">Data da prova (opcional)<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" /></label></div>
      <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center font-bold text-blue-900 transition hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><UploadCloud className="h-6 w-6" /><span>{file ? file.name : 'Selecionar edital em PDF'}</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <div className="my-4 flex items-center gap-3 text-xs font-black uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />ou cole o conteúdo<span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} className="w-full rounded-xl border border-slate-300 p-4 dark:border-slate-700 dark:bg-slate-950" placeholder="Cole aqui apenas a seção de conteúdo programático se o PDF for digitalizado ou não permitir seleção de texto." />
      <button onClick={save} disabled={saving || (!file && text.trim().length < 30)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-black text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{progress || 'Analisar edital'}</button>
    </section>}

    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-700" /></div> : !active ? <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900"><FileSearch className="mx-auto h-12 w-12 text-blue-700" /><h2 className="mt-4 text-xl font-black">Adicione seu primeiro edital</h2><p className="mt-2 text-slate-500">O processamento inicial é local e não consome tokens de geração.</p></section> : <>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[BookOpenCheck,activeTopicCount,'Tópicos indexados'],[Layers3,active.sections.length,'Seções encontradas'],[CalendarDays,active.examDate ? new Date(`${active.examDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Não definida','Data da prova'],[FileSearch,active.sourceFileName ? 'PDF' : 'Texto','Origem do edital']].map(([Icon,value,label]) => { const I = Icon as typeof BookOpenCheck; return <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><I className="h-5 w-5" /></span><p className="mt-4 text-2xl font-black">{String(value)}</p><p className="text-sm text-slate-500">{String(label)}</p></article> })}</section>

      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-7">
          <div className="min-w-0"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Edital ativo</span><h2 className="mt-3 truncate text-2xl font-black">{active.title}</h2><p className="mt-1 truncate text-sm text-slate-500">{active.sourceFileName || 'Conteúdo colado manualmente'}</p></div>

          {active.warnings.length > 0 && <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Revise a organização automática</p><p className="mt-1">{active.warnings[0]}</p></div></div>}

          <div className="mt-5 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30">
            <p className="mb-3 text-sm font-black text-blue-950 dark:text-blue-100">Pesquisar neste edital</p>
            <label className="relative block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" /><span className="sr-only">Pesquisar no edital</span><input value={topicQuery} onChange={(event) => setTopicQuery(event.target.value)} className="w-full rounded-xl border border-blue-200 bg-white py-3.5 pl-12 pr-28 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-blue-900 dark:bg-slate-950 dark:focus:ring-blue-950" placeholder="Digite uma disciplina, lei, cargo, data ou palavra-chave..." /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{searchResultCount} resultado{searchResultCount === 1 ? '' : 's'}</span></label>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">{active.sections.map((section, sectionIndex) => <ExamTopicsSection key={`${section.id}-${sectionIndex}`} section={section} sectionIndex={sectionIndex} query={topicQuery} />)}</div>
      </section>

      {notices.length > 1 && <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><h2 className="font-black">Outros editais</h2><p className="mt-1 text-sm text-slate-500">Alterne o edital usado no planejamento.</p><div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{notices.filter((notice) => notice.id !== active.id).map((notice) => <div key={notice.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-bold">{notice.title}</p><p className="text-xs text-slate-500">{notice.progress}% coberto</p></div><div className="flex gap-2"><button onClick={() => update(notice.id, 'activate')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-700">Ativar</button><button onClick={() => update(notice.id, 'remove')} aria-label={`Excluir ${notice.title}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button></div></div>)}</div></section>}
    </>}
  </div>
}

function ExamTopicsSection({ section, sectionIndex, query }: {
  section: Notice['sections'][number]
  sectionIndex: number
  query: string
}) {
  const [visibleCount, setVisibleCount] = useState(10)
  const [open, setOpen] = useState(sectionIndex === 0)
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const filteredTopics = useMemo(() => section.topics.filter((topic) => {
    return !normalizedQuery || `${section.title} ${topic.subject} ${topic.title}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
  }), [normalizedQuery, section.title, section.topics])
  const visibleTopics = filteredTopics.slice(0, visibleCount)

  useEffect(() => { setVisibleCount(10) }, [normalizedQuery])

  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:px-5">
      <div className="min-w-0"><h3 className="truncate font-black">{section.title}</h3><p className="mt-1 text-xs text-slate-500">{filteredTopics.length} de {section.topics.length} tópico{section.topics.length === 1 ? '' : 's'}</p></div>
      <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500"><span className="hidden sm:inline">Ver conteúdo</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
    </summary>
    <div className="border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4">
      {visibleTopics.length ? <div className="grid gap-2.5">{visibleTopics.map((topic, topicIndex) => <article key={`${section.id}-${topic.id}-${topicIndex}`} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300">{topicIndex + 1}</span>
        <div className="min-w-0"><p className="font-bold leading-relaxed" title={topic.title}>{topic.title}</p>{topic.subject && topic.subject !== section.title && <p className="mt-2 text-xs font-semibold text-slate-500">{topic.subject}</p>}</div>
      </article>)}</div> : <div className="rounded-2xl bg-slate-50 p-8 text-center dark:bg-slate-950/60"><Search className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-bold">Nenhum resultado encontrado</p><p className="mt-1 text-sm text-slate-500">Tente outra palavra-chave ou uma busca mais curta.</p></div>}
      {visibleCount < filteredTopics.length && <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/30">Mostrar mais {Math.min(10, filteredTopics.length - visibleCount)} tópicos</button>}
      {filteredTopics.length > 0 && <p className="mt-3 text-center text-xs text-slate-400">Exibindo {visibleTopics.length} de {filteredTopics.length} tópicos</p>}
    </div>
  </details>
}
