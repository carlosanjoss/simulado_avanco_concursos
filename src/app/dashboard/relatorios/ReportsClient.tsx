'use client'

import { useMemo, useState, type ComponentType } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, CalendarCheck2,
  ChartNoAxesCombined, Clock3, Filter, Lightbulb, Printer, RotateCcw,
  Target, TrendingDown, TrendingUp, Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '@/components/theme-provider'

interface Outcome { key: string; questionId: number; theme: string; difficulty: string; statement: string; correct: boolean }
interface RecordData { id: string; simuladoId: string; title: string; date: string; completed: boolean; percent: number; durationSeconds: number; answered: number; totalQuestions: number; currentIndex: number; abandoned: boolean; materials: string[]; outcomes: Outcome[] }
interface ReportData {
  records: RecordData[]
  dueReviews: number
  benchmark: { available: boolean; users: number; attempts: number; average: number | null }
  goals: { weeklyTarget: number; weeklyCompleted: number; monthlyTarget: number; monthlyCompleted: number }
}
interface Group { label: string; correct: number; total: number; percent: number }
type View = 'overview' | 'evolution' | 'attention'

const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e']
const views: Array<{ id: View; label: string; shortLabel: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Visão geral', shortLabel: 'Visão geral', icon: BarChart3 },
  { id: 'evolution', label: 'Evolução', shortLabel: 'Evolução', icon: ChartNoAxesCombined },
  { id: 'attention', label: 'Pontos de atenção', shortLabel: 'Atenção', icon: AlertTriangle },
]

export default function ReportsClient({ data }: { data: ReportData }) {
  const { theme: colorMode } = useTheme()
  const [view, setView] = useState<View>('overview')
  const [period, setPeriod] = useState('90')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [material, setMaterial] = useState('Todos')
  const [theme, setTheme] = useState('Todos')
  const [difficulty, setDifficulty] = useState('Todas')
  const dark = colorMode === 'dark'
  const chartGrid = dark ? '#26364c' : '#e2e8f0'
  const chartText = dark ? '#9fb0c6' : '#64748b'
  const tooltipStyle = { background: dark ? '#0d192b' : '#fff', border: `1px solid ${chartGrid}`, borderRadius: 12, color: dark ? '#e7eef9' : '#06183d' }

  const materials = useMemo(() => [...new Set(data.records.flatMap((record) => record.materials))].sort(), [data.records])
  const themes = useMemo(() => [...new Set(data.records.flatMap((record) => record.outcomes.map((outcome) => outcome.theme)))].sort(), [data.records])
  const range = useMemo(() => {
    const end = toDate ? new Date(`${toDate}T23:59:59`) : new Date()
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : period === 'ALL' ? new Date(0) : new Date(end.getTime() - Number(period) * 86_400_000)
    return { start, end }
  }, [fromDate, period, toDate])

  const dimensionRecords = useMemo(() => data.records
    .map((record) => ({
      ...record,
      outcomes: record.outcomes.filter((outcome) => (theme === 'Todos' || outcome.theme === theme) && (difficulty === 'Todas' || outcome.difficulty === difficulty)),
    }))
    .filter((record) => (material === 'Todos' || record.materials.includes(material)) && ((theme === 'Todos' && difficulty === 'Todas') || record.outcomes.length > 0)), [data.records, difficulty, material, theme])

  const filtered = useMemo(() => dimensionRecords.filter((record) => {
    const date = new Date(record.date)
    return date >= range.start && date <= range.end
  }), [dimensionRecords, range])
  const completed = filtered.filter((record) => record.completed)
  const outcomes = completed.flatMap((record) => record.outcomes)
  const answered = outcomes.length
  const correct = outcomes.filter((outcome) => outcome.correct).length
  const average = answered ? Math.round(correct / answered * 100) : 0
  const estimatedFilteredDuration = completed.reduce((sum, record) => sum + (record.answered ? record.durationSeconds / record.answered * record.outcomes.length : 0), 0)
  const avgSecondsQuestion = answered ? Math.round(estimatedFilteredDuration / answered) : 0
  const abandoned = filtered.filter((record) => record.abandoned).length
  const abandonRate = filtered.length ? Math.round(abandoned / filtered.length * 100) : 0
  const themeGroups = useMemo(() => makeGroups(outcomes, (outcome) => outcome.theme), [outcomes])
  const difficultyGroups = useMemo(() => makeGroups(outcomes, (outcome) => outcome.difficulty), [outcomes])

  const mostWrong = useMemo(() => {
    const map = new Map<string, { statement: string; theme: string; wrong: number; attempts: number }>()
    for (const outcome of outcomes) {
      const item = map.get(outcome.key) || { statement: outcome.statement, theme: outcome.theme, wrong: 0, attempts: 0 }
      item.attempts += 1
      if (!outcome.correct) item.wrong += 1
      map.set(outcome.key, item)
    }
    return [...map.values()].filter((item) => item.wrong > 0).sort((a, b) => b.wrong - a.wrong || b.attempts - a.attempts).slice(0, 8)
  }, [outcomes])

  const themeEvolution = useMemo(() => {
    const topThemes = themeGroups.slice(0, 5).map((group) => group.label)
    const months = new Map<string, Record<string, number | string>>()
    const counters = new Map<string, { correct: number; total: number }>()
    for (const record of completed) for (const outcome of record.outcomes) {
      if (!topThemes.includes(outcome.theme)) continue
      const month = record.date.slice(0, 7)
      const key = `${month}\u0000${outcome.theme}`
      const count = counters.get(key) || { correct: 0, total: 0 }
      count.total += 1
      if (outcome.correct) count.correct += 1
      counters.set(key, count)
    }
    for (const [key, count] of counters) {
      const [month, themeName] = key.split('\u0000')
      const row = months.get(month) || { month: formatMonth(month) }
      row[themeName] = Math.round(count.correct / count.total * 100)
      months.set(month, row)
    }
    return { themes: topThemes, rows: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row) }
  }, [completed, themeGroups])

  const comparison = useMemo(() => {
    if (period === 'ALL' && !fromDate) return { previousAverage: null, delta: null }
    const duration = Math.max(1, range.end.getTime() - range.start.getTime())
    const previousEnd = new Date(range.start.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - duration)
    const previous = dimensionRecords.filter((record) => record.completed && new Date(record.date) >= previousStart && new Date(record.date) <= previousEnd)
    const previousOutcomes = previous.flatMap((record) => record.outcomes)
    const previousCorrect = previousOutcomes.filter((outcome) => outcome.correct).length
    const previousAverage = previousOutcomes.length ? Math.round(previousCorrect / previousOutcomes.length * 100) : null
    return { previousAverage, delta: previousAverage === null ? null : average - previousAverage }
  }, [average, dimensionRecords, fromDate, period, range])

  const weakThemes = themeGroups.filter((group) => group.total >= 3 && group.percent < 70).slice().sort((a, b) => a.percent - b.percent).slice(0, 3)
  const recentCompleted = [...completed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const activeFilters = [material !== 'Todos', theme !== 'Todos', difficulty !== 'Todas', Boolean(fromDate), Boolean(toDate)].filter(Boolean).length
  const resetFilters = () => { setPeriod('90'); setFromDate(''); setToDate(''); setMaterial('Todos'); setTheme('Todos'); setDifficulty('Todas') }
  const level = average >= 80 ? 'Excelente' : average >= 65 ? 'Bom ritmo' : average >= 45 ? 'Em evolução' : answered ? 'Precisa de atenção' : 'Sem dados'

  return <div className="mx-auto max-w-7xl p-4 pb-12 sm:p-6 lg:p-8 print:max-w-none print:p-0">
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#031b43] via-[#07347d] to-[#0867df] p-6 text-white shadow-xl sm:p-8 print:bg-white print:text-black print:shadow-none">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#ffc400]/15 blur-3xl print:hidden" />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-blue-200"><TrendingUp className="h-4 w-4 text-[#ffc400]" /> Central de desempenho</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Entenda seu progresso</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-blue-100">Veja o que evoluiu, identifique lacunas e transforme seus resultados em próximas ações de estudo.</p>
        </div>
        <div className="flex items-center gap-5 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-[#ffc400] bg-[#061b46] text-2xl font-black">{average}%</div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-200">Aproveitamento</p><p className="mt-1 text-xl font-black">{level}</p><p className="mt-1 text-sm text-blue-100">{answered} questões analisadas</p></div>
        </div>
      </div>
    </section>

    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#0d192b] sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Áreas de desempenho">
        {views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${view === item.id ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><item.icon className="h-4 w-4" /><span className="hidden sm:inline">{item.label}</span><span className="sm:hidden">{item.shortLabel}</span></button>)}
      </div>
      <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Printer className="h-4 w-4" /> Imprimir relatório</button>
    </div>

    <details className="group mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d192b] print:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:px-5">
        <span className="flex items-center gap-3 font-black"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Filter className="h-4 w-4" /></span>Filtros do relatório {activeFilters > 0 && <span className="rounded-full bg-blue-700 px-2.5 py-1 text-xs text-white">{activeFilters}</span>}</span>
        <span className="text-xs font-bold text-slate-500 group-open:hidden">Abrir filtros</span>
      </summary>
      <div className="border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Período"><select value={period} onChange={(event) => { setPeriod(event.target.value); setFromDate('') }}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180">Últimos 180 dias</option><option value="ALL">Todo o histórico</option></select></Field>
          <Field label="Material"><select value={material} onChange={(event) => setMaterial(event.target.value)}><option>Todos</option>{materials.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Tema"><select value={theme} onChange={(event) => setTheme(event.target.value)}><option>Todos</option>{themes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Dificuldade"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>Todas</option><option>Fácil</option><option>Médio</option><option>Avançado</option></select></Field>
          <Field label="De"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field>
          <Field label="Até"><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></Field>
        </div>
        <button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300"><RotateCcw className="h-4 w-4" />Limpar filtros</button>
      </div>
    </details>

    {view === 'overview' && <div role="tabpanel" className="animate-in">
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Target} label="Aproveitamento" value={`${average}%`} note={comparison.delta === null ? 'Sem comparação anterior' : `${comparison.delta >= 0 ? '+' : ''}${comparison.delta} pontos no período`} tone="blue" />
        <Metric icon={Clock3} label="Tempo por questão" value={formatDuration(avgSecondsQuestion)} note="Média nas questões filtradas" tone="violet" />
        <Metric icon={BookOpenCheck} label="Questões respondidas" value={answered} note={`${completed.length} simulados concluídos`} tone="emerald" />
        <Metric icon={TrendingDown} label="Taxa de abandono" value={`${abandonRate}%`} note={`${abandoned} tentativa(s) não concluída(s)`} tone={abandonRate > 20 ? 'rose' : 'amber'} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card title="Comparação entre períodos" description="Período atual contra o intervalo imediatamente anterior.">
          <div className="mt-6 grid grid-cols-2 gap-4"><Comparison label="Atual" value={average} featured /><Comparison label="Anterior" value={comparison.previousAverage} /></div>
          {comparison.delta !== null && <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${comparison.delta >= 0 ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:text-rose-300'}`}>{comparison.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{comparison.delta >= 0 ? '+' : ''}{comparison.delta} pontos</p>}
        </Card>
        <Card title="Metas de estudo" description="Seu ritmo de execução do plano.">
          <Goal label="Meta semanal" completed={data.goals.weeklyCompleted} target={data.goals.weeklyTarget} />
          <Goal label="Meta mensal" completed={data.goals.monthlyCompleted} target={data.goals.monthlyTarget} />
          <Link href="/dashboard/planos" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">Ajustar metas <ArrowRight className="h-4 w-4" /></Link>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <GroupChart title="Desempenho por tema" groups={themeGroups} />
        <GroupChart title="Desempenho por dificuldade" groups={difficultyGroups} />
      </div>
    </div>}

    {view === 'evolution' && <div role="tabpanel" className="animate-in">
      <Card className="mt-5" title="Evolução por tema" description="Percentual mensal dos temas mais praticados no período.">
        <div className="mt-6 h-80">{themeEvolution.rows.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={themeEvolution.rows}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fill: chartText, fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: chartText, fontSize: 12 }} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} /><Legend />{themeEvolution.themes.map((item, index) => <Line key={item} type="monotone" dataKey={item} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer> : <Empty text="Conclua simulados em pelo menos dois meses para visualizar a evolução." />}</div>
      </Card>
      <Card className="mt-5" title="Atividade recente" description="Seus últimos simulados concluídos no período.">
        <div className="mt-5 grid gap-3 md:grid-cols-2">{recentCompleted.length ? recentCompleted.map((record) => <Link key={record.id} href={`/dashboard/simulado/${record.simuladoId}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:bg-slate-800"><div className="min-w-0"><p className="truncate font-black">{record.title}</p><p className="mt-1 text-xs text-slate-500">{new Date(record.date).toLocaleDateString('pt-BR')} · {record.answered} questões · {formatDuration(record.durationSeconds)}</p></div><span className={`shrink-0 rounded-xl px-3 py-2 font-black ${record.percent >= 70 ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:text-amber-300'}`}>{Math.round(record.percent)}%</span></Link>) : <Empty text="Nenhum simulado concluído nos filtros atuais." />}</div>
      </Card>
    </div>}

    {view === 'attention' && <div role="tabpanel" className="animate-in">
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card title="Questões mais erradas" description="Priorize os conteúdos que continuam causando dúvida.">
          <div className="mt-5 space-y-3">{mostWrong.length ? mostWrong.map((item, index) => <article key={`${item.statement}:${index}`} className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/50"><div className="flex justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">{item.theme}</p><p className="mt-1 text-sm font-bold leading-relaxed">{item.statement}</p></div><span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-sm font-black text-rose-700 dark:bg-slate-900 dark:text-rose-300">{item.wrong} erro(s)</span></div></article>) : <Empty text="Nenhum erro encontrado nos filtros atuais." />}</div>
        </Card>
        <Card title="Próximas ações" description="Recomendações baseadas no seu histórico.">
          <div className="mt-5 space-y-3">{weakThemes.map((item) => <Link key={item.label} href={`/dashboard/novo?focus=${encodeURIComponent(item.label)}`} className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-400 dark:border-amber-900/60"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-black text-amber-950 dark:text-amber-200">Praticar {item.label}</p><p className="mt-1 text-sm text-amber-900 dark:text-amber-300">{item.percent}% de aproveitamento em {item.total} questões.</p><span className="mt-2 inline-flex items-center gap-1 text-sm font-black text-blue-700 dark:text-blue-300">Criar simulado focado <ArrowRight className="h-4 w-4" /></span></div></div></Link>)}{data.dueReviews > 0 && <Link href="/dashboard/caderno-erros" className="block rounded-2xl border border-blue-200 bg-blue-50 p-4 font-bold text-blue-900 dark:border-blue-900 dark:text-blue-200">Você tem {data.dueReviews} revisão(ões) vencida(s). Revisar agora.</Link>}{!weakThemes.length && data.dueReviews === 0 && <Empty text="Nenhuma recomendação urgente neste período." />}</div>
          <Link href="/dashboard/planos" className="mt-5 inline-flex items-center gap-2 font-black text-blue-700 dark:text-blue-300"><CalendarCheck2 className="h-4 w-4" />Abrir plano de estudos</Link>
        </Card>
      </div>

      <Card className="mt-5" title="Comparação anônima" description="Exibida apenas com volume suficiente para preservar a privacidade." icon={Users}>
        {data.benchmark.available ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><Comparison label="Seu resultado" value={average} featured /><Comparison label="Média anônima" value={data.benchmark.average} /><div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-3xl font-black">{data.benchmark.users}</p><p className="mt-1 text-sm text-slate-500">estudantes na amostra</p></div></div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ainda não há volume suficiente para uma comparação confiável. Amostra atual: {data.benchmark.users} estudantes e {data.benchmark.attempts} tentativas.</p>}
      </Card>
    </div>}
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}{children && <span className="mt-1 block [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-slate-300 [&>*]:px-3 [&>*]:py-2.5 [&>*]:text-sm [&>*]:font-semibold [&>*]:normal-case [&>*]:tracking-normal dark:[&>*]:border-slate-700">{children}</span>}</label>
}

function Card({ title, description, children, className = '', icon: Icon }: { title: string; description: string; children: React.ReactNode; className?: string; icon?: ComponentType<{ className?: string }> }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0d192b] sm:p-6 ${className}`}><div className="flex items-start gap-3">{Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Icon className="h-5 w-5" /></span>}<div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>{children}</section>
}

const metricTones = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number; note: string; tone: keyof typeof metricTones }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0d192b]"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${metricTones[tone]}`}><Icon className="h-5 w-5" /></span><p className="mt-4 text-3xl font-black">{value}</p><p className="mt-1 font-bold">{label}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>
}

function Comparison({ label, value, featured = false }: { label: string; value: number | null; featured?: boolean }) {
  return <div className={`rounded-2xl p-5 ${featured ? 'bg-blue-700 text-white' : 'bg-slate-50 dark:bg-slate-800'}`}><p className={`text-sm ${featured ? 'text-blue-100' : 'text-slate-500'}`}>{label}</p><p className="mt-1 text-3xl font-black">{value === null ? '—' : `${value}%`}</p></div>
}

function Goal({ label, completed, target }: { label: string; completed: number; target: number }) {
  const percent = Math.min(100, target ? completed / target * 100 : 0)
  return <div className="mt-5"><div className="flex justify-between text-sm"><span className="font-bold">{label}</span><strong>{completed}/{target}</strong></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-400" style={{ width: `${percent}%` }} /></div></div>
}

function GroupChart({ title, groups }: { title: string; groups: Group[] }) {
  const shown = groups.slice(0, 8)
  const chartHeight = Math.max(260, shown.length * 44)
  return <Card title={title} description="Percentual de acertos e volume respondido.">
    <div className="mt-5" style={{ height: chartHeight }}>
      {shown.length ? <ResponsiveContainer width="100%" height="100%">
        <BarChart data={shown} layout="vertical" margin={{ left: 8, right: 14, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 11 }} className="text-slate-500 dark:text-slate-400" tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="label" width={174} interval={0} tickLine={false} axisLine={false} tick={<GroupAxisTick />} />
          <Tooltip formatter={(value, _name, item) => [`${value}% (${item.payload.correct}/${item.payload.total})`, item.payload.label]} contentStyle={{ borderRadius: 12 }} />
          <Bar dataKey="percent" radius={[0, 6, 6, 0]} maxBarSize={24}>{shown.map((group) => <Cell key={group.label} fill={colorFor(group.percent)} />)}</Bar>
        </BarChart>
      </ResponsiveContainer> : <Empty text="Sem dados suficientes." />}
    </div>
  </Card>
}

function GroupAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = payload?.value || ''
  const label = value.length > 25 ? `${value.slice(0, 24).trimEnd()}…` : value
  return <g transform={`translate(${x},${y})`}>
    <title>{value}</title>
    <text x={-8} dy="0.32em" textAnchor="end" className="fill-slate-600 text-[11px] dark:fill-slate-300">{label}</text>
  </g>
}

function Empty({ text }: { text: string }) { return <div className="flex min-h-32 items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800">{text}</div> }
function makeGroups(outcomes: Outcome[], label: (outcome: Outcome) => string): Group[] { const map = new Map<string, { correct: number; total: number }>(); for (const outcome of outcomes) { const key = label(outcome); const item = map.get(key) || { correct: 0, total: 0 }; item.total += 1; if (outcome.correct) item.correct += 1; map.set(key, item) } return [...map.entries()].map(([name, item]) => ({ label: name, ...item, percent: Math.round(item.correct / item.total * 100) })).sort((a, b) => b.total - a.total) }
function colorFor(percent: number) { return percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#f43f5e' }
function formatDuration(seconds: number) { if (!seconds) return '—'; return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s` }
function formatMonth(value: string) { const [year, month] = value.split('-'); return `${month}/${year.slice(2)}` }
