'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BookOpenCheck, CalendarDays, Check, Clock3, Flame, History, Play, Save, Settings2, Target } from 'lucide-react'
import { toast } from 'sonner'
import type { AdaptiveStudyTask } from '@/lib/study-plan'

interface Settings { examName: string; examDate: string; availableDays: number[]; minutesPerDay: number; weeklyGoal: number; notificationsEnabled: boolean }
interface WeekHistory { weekKey: string; completed: number; total: number }
const weekDays = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']] as const

export default function StudyPlanClient({ tasks, weekKey, initialCompleted, settings: initialSettings, history, streak, dueReviews }: {
  tasks: AdaptiveStudyTask[]; weekKey: string; initialCompleted: string[]; settings: Settings; history: WeekHistory[]; streak: number; dueReviews: number
}) {
  const router = useRouter()
  const [completed, setCompleted] = useState(initialCompleted)
  const [settings, setSettings] = useState(initialSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const percentage = tasks.length ? Math.round(completed.filter((id) => tasks.some((task) => task.id === id)).length / tasks.length * 100) : 0

  useEffect(() => {
    fetch('/api/study-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', weekKey, tasks: tasks.map((task) => ({ id: task.id, scheduledDate: task.scheduledDate, theme: task.theme, mode: task.mode, duration: task.duration })) }) }).catch(() => undefined)
  }, [tasks, weekKey])

  const examCountdown = useMemo(() => settings.examDate ? Math.max(0, Math.ceil((new Date(`${settings.examDate}T12:00:00`).getTime() - Date.now()) / 86_400_000)) : null, [settings.examDate])

  async function toggle(task: AdaptiveStudyTask) {
    const wasCompleted = completed.includes(task.id)
    setCompleted((current) => wasCompleted ? current.filter((id) => id !== task.id) : [...current, task.id])
    const response = await fetch('/api/study-plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'progress', weekKey, taskKey: task.id, completed: !wasCompleted }) })
    if (!response.ok) {
      setCompleted((current) => wasCompleted ? [...new Set([...current, task.id])] : current.filter((id) => id !== task.id))
      toast.error('Não foi possível sincronizar o progresso.')
    }
  }

  async function saveSettings() {
    setSaving(true)
    const response = await fetch('/api/study-plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', ...settings, examName: settings.examName.trim() || null, examDate: settings.examDate || null }) })
    setSaving(false)
    if (!response.ok) return toast.error('Não foi possível salvar as preferências.')
    toast.success('Plano recalculado com suas preferências.')
    setShowSettings(false)
    router.refresh()
  }

  return <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Planejamento adaptativo</p><h1 className="mt-2 text-3xl font-black">Plano de estudos</h1><p className="mt-2 text-slate-600">Prioriza seus pontos fracos, revisões vencidas e a proximidade da prova.</p></div><button onClick={() => setShowSettings((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-black"><Settings2 className="h-5 w-5" /> Configurar rotina</button></div>

    {settings.notificationsEnabled && dueReviews > 0 && <Link href="/dashboard/caderno-erros" className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><Bell className="h-5 w-5" /><span><strong>{dueReviews} revisão(ões) aguardando hoje.</strong> Abra o caderno para manter sua sequência.</span></Link>}

    {showSettings && <section className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Objetivo e disponibilidade</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Prova-alvo<input value={settings.examName} onChange={(event) => setSettings({ ...settings, examName: event.target.value })} placeholder="Ex.: Polícia Federal" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Data da prova<input type="date" value={settings.examDate} onChange={(event) => setSettings({ ...settings, examDate: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Minutos por dia<input type="number" min={15} max={240} value={settings.minutesPerDay} onChange={(event) => setSettings({ ...settings, minutesPerDay: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Meta semanal<input type="number" min={1} max={14} value={settings.weeklyGoal} onChange={(event) => setSettings({ ...settings, weeklyGoal: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label></div><div className="mt-5"><p className="text-sm font-bold">Dias disponíveis</p><div className="mt-2 flex flex-wrap gap-2">{weekDays.map(([value, label]) => <button key={value} onClick={() => setSettings((current) => ({ ...current, availableDays: current.availableDays.includes(value) ? current.availableDays.filter((day) => day !== value) : [...current.availableDays, value] }))} className={`rounded-xl px-4 py-2 text-sm font-black ${settings.availableDays.includes(value) ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div></div><label className="mt-5 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.notificationsEnabled} onChange={(event) => setSettings({ ...settings, notificationsEnabled: event.target.checked })} /> Mostrar lembretes internos de revisão</label><button disabled={saving || !settings.availableDays.length} onClick={saveSettings} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar e recalcular</button></section>}

    <section className="mt-7 grid gap-4 md:grid-cols-4"><Metric icon={Target} label="Meta semanal" value={`${completed.length}/${tasks.length}`} /><Metric icon={Flame} label="Sequência" value={`${streak} dia(s)`} /><Metric icon={BookOpenCheck} label="Revisões vencidas" value={String(dueReviews)} /><Metric icon={CalendarDays} label={settings.examName || 'Prova-alvo'} value={examCountdown === null ? 'Não definida' : `${examCountdown} dias`} /></section>

    <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]"><section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Próximas sessões</h2><p className="text-sm text-slate-500">Tarefas antigas não concluídas recebem prioridade automaticamente.</p></div><strong className="text-blue-700">{percentage}%</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: `${percentage}%` }} /></div></div><div className="divide-y divide-slate-100">{tasks.map((task) => { const done = completed.includes(task.id); return <article key={task.id} className={done ? 'bg-emerald-50/50 p-5' : 'p-5'}><div className="flex gap-4"><button onClick={() => toggle(task)} aria-label={done ? 'Marcar como pendente' : 'Concluir tarefa'} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-emerald-600 text-white' : 'bg-blue-50 text-blue-700'}`}>{done ? <Check className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="text-blue-700">{task.dayLabel}</span><span className="rounded-full bg-slate-100 px-2 py-1">{task.mode}</span><span className="inline-flex items-center gap-1 text-slate-500"><Clock3 className="h-3.5 w-3.5" />{task.duration} min</span></div><h3 className={`mt-2 font-black ${done ? 'text-slate-500 line-through' : ''}`}>{task.title}</h3><p className="mt-1 text-sm text-slate-500">{task.detail}</p><div className="mt-3 flex flex-wrap gap-3"><Link href={task.mode === 'Revisão espaçada' && dueReviews ? '/dashboard/caderno-erros' : task.focusUrl} className="text-sm font-black text-blue-700">{task.mode === 'Revisão espaçada' && dueReviews ? 'Revisar agora' : 'Criar simulado deste tema'}</Link></div></div></div></article>})}</div></section>
      <aside className="space-y-5"><section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><History className="h-5 w-5 text-blue-700" /><h2 className="font-black">Histórico semanal</h2></div><div className="mt-4 space-y-3">{history.length ? history.map((item) => <div key={item.weekKey}><div className="flex justify-between text-sm"><span>Semana {item.weekKey.slice(5)}</span><strong>{item.completed}/{item.total}</strong></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.total ? item.completed / item.total * 100 : 0}%` }} /></div></div>) : <p className="text-sm text-slate-500">O histórico aparecerá após suas primeiras atividades.</p>}</div></section><section className="rounded-3xl bg-[#061b46] p-6 text-white"><Bell className="h-6 w-6 text-[#ffc400]" /><h2 className="mt-3 font-black">Replanejamento automático</h2><p className="mt-2 text-sm text-blue-100">Tarefas pendentes, erros recentes e revisões vencidas entram no próximo cálculo sem você reorganizar tudo manualmente.</p></section></aside>
    </div>
  </div>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className="h-5 w-5 text-blue-700" /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-sm text-slate-500">{label}</p></article>
}
