'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/components/providers'
import { useState } from 'react'
import { ArrowRight, BarChart3, Bell, BookOpenCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Crown, FilePlus2, FileText, MailPlus, NotebookPen, Pencil, Play, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import DashboardShell from '../../components/dashboard/DashboardShell'

interface Simulado {
  id: string
  titulo: string
  totalQuestoes: number
  temasFoco: string | null
  pdfNome: string
  status: string
  createdAt: string
  tentativa: { pontuacao: number; percentual: number; concluidoEm: string | null; currentIndex: number } | null
}

interface DashboardClientProps {
  simulados: Simulado[]
  stats: { completed: number; average: number; answered: number; remaining: number | null; used: number; unlimited: boolean; limit: number | null; isPro: boolean; dueReviews: number }
}

function getQuestionText(simulado: Simulado, completed: boolean, inProgress: boolean): string {
  const base = `${simulado.totalQuestoes} questões · `
  if (completed) {
    return base + `Concluído em ${format(new Date(simulado.tentativa!.concluidoEm!), 'dd/MM/yyyy', { locale: ptBR })}`
  }
  if (inProgress) {
    return base + `Em andamento · questão ${(simulado.tentativa?.currentIndex || 0) + 1}`
  }
  return base + `Criado em ${format(new Date(simulado.createdAt), 'dd/MM/yyyy', { locale: ptBR })}`
}

function formatDaysRemaining(expiresAt: string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Expirado'
  if (days === 1) return 'Expira hoje'
  return `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`
}

export default function DashboardClient({ simulados, stats }: DashboardClientProps) {
  const { user } = useAuth()
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 5
  const historyPageCount = Math.max(1, Math.ceil(simulados.length / historyPageSize))
  const visibleSimulados = simulados.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<{ email: string; name: string; inviteUrl: string } | null>(null)

  const statCards = [
    { label: 'Simulados realizados', value: stats.completed, icon: FileText, color: 'text-blue-700 bg-blue-50' },
    { label: 'Média de acertos', value: `${stats.average}%`, icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Questões respondidas', value: stats.answered, icon: Target, color: 'text-amber-600 bg-amber-50' },
    { label: 'Disponíveis no mês', value: stats.unlimited ? 'Ilimitado' : `${stats.remaining} de ${stats.limit}`, icon: Clock3, color: 'text-rose-600 bg-rose-50' },
  ]

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setInviteLink(null)
    setShowPreview(false)
    setPreviewData(null)

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || undefined, preview: true }),
      })

      const data = await res.json()

      if (res.ok) {
        // Show preview modal
        setPreviewData({
          email: inviteEmail.trim(),
          name: inviteName.trim() || 'Usuário',
          inviteUrl: data.inviteUrl || '',
        })
        setShowPreview(true)
      } else {
        if (res.status === 400 && data.inviteId) {
          // Já existe convite pendente - oferece reenviar
          const resend = await fetch('/api/admin/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || undefined, resend: true, preview: true }),
          })
          const resendData = await resend.json()
          if (resend.ok) {
            setPreviewData({
              email: inviteEmail.trim(),
              name: inviteName.trim() || 'Usuário',
              inviteUrl: resendData.inviteUrl || '',
            })
            setShowPreview(true)
          } else {
            toast.error(resendData.error || 'Erro ao reenviar convite')
          }
        } else {
          toast.error(data.error || 'Erro ao enviar convite')
        }
      }
    } catch (error) {
      toast.error('Erro ao enviar convite')
    } finally {
      setInviting(false)
    }
  }

  const confirmInvite = async () => {
    if (!previewData) return
    setShowPreview(false)
    setInviting(true)

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: previewData.email, name: previewData.name, resend: !!previewData.inviteUrl }),
      })

      const data = await res.json()

      if (res.ok) {
        setInviteLink(data.inviteUrl || null)
        if (data.emailSent) {
          toast.success(`Convite enviado por e-mail para ${previewData.email}.`)
        } else if (data.emailError === 'EMAIL_NOT_CONFIGURED') {
          toast.success('Convite criado. E-mail não configurado — copie o link abaixo e envie manualmente.')
        } else {
          toast.warning(`Convite criado, mas o e-mail falhou: ${data.emailError || 'erro desconhecido'}. Copie o link abaixo e envie manualmente.`)
        }
        setInviteEmail('')
        setInviteName('')
        setShowInviteForm(false)
      } else {
        toast.error(data.error || 'Erro ao confirmar convite')
      }
    } catch (error) {
      toast.error('Erro ao confirmar convite')
    } finally {
      setInviting(false)
    }
  }

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      toast.success('Link copiado!')
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl p-4 pb-12 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071a42] via-[#0b3274] to-blue-600 px-6 py-7 text-white shadow-xl shadow-blue-950/10 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_310px] lg:items-center">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                  {stats.isPro ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : <Sparkles className="h-3.5 w-3.5 text-cyan-200" />}
                  Plano {stats.isPro ? 'Pro' : 'Grátis'}
                </span>
                <span className="text-xs font-semibold text-blue-100">Sua central de estudos</span>
              </div>
              <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Olá, {user?.name || 'Estudante'}! <span aria-hidden>👋</span></h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Continue de onde parou ou transforme um novo material em questões personalizadas.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/dashboard/novo" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-800 shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50">
                  <FilePlus2 className="h-4 w-4" /> Criar simulado
                </Link>
                <Link href="/dashboard/hoje" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
                  <CalendarDays className="h-4 w-4" /> Ver meu dia
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Uso mensal</p>
                  <p className="mt-2 text-2xl font-black">{stats.unlimited ? 'Ilimitado' : `${stats.used} de ${stats.limit}`}</p>
                  <p className="mt-1 text-xs text-blue-100">{stats.unlimited ? 'Conta sem limite de gerações' : `${stats.remaining} geração${stats.remaining === 1 ? '' : 'ões'} disponível${stats.remaining === 1 ? '' : 'is'}`}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><TrendingUp className="h-5 w-5" /></span>
              </div>
              {!stats.unlimited && (
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15" aria-label={`${stats.used} de ${stats.limit} gerações utilizadas`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-white transition-all" style={{ width: `${Math.min(100, Math.max(0, ((stats.used || 0) / Math.max(stats.limit || 1, 1)) * 100))}%` }} />
                </div>
              )}
              {!stats.isPro && <Link href="/dashboard/assinatura" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-white hover:text-cyan-200">Conhecer o Pro <ArrowRight className="h-3.5 w-3.5" /></Link>}
            </div>
          </div>
        </section>

        {stats.dueReviews > 0 && (
          <Link href="/dashboard/caderno-erros" className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><Bell className="h-5 w-5" /></span>
            <span className="flex-1"><strong>{stats.dueReviews} revisão{stats.dueReviews === 1 ? '' : 'ões'} vencida{stats.dueReviews === 1 ? '' : 's'}.</strong> Abra o caderno de erros para manter seu plano em dia.</span>
            <ArrowRight className="hidden h-4 w-4 sm:block" />
          </Link>
        )}

        <section id="estatisticas" className="scroll-margin-top-20 grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105 ${color}`}>
                <Icon className="w-6 h-6" />
              </span>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section id="historico" className="scroll-margin-top-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div>
              <h2 className="text-xl font-black">Atividade recente</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Retome ou confira seus últimos simulados</p>
            </div>
            <span className="text-sm text-blue-700 font-semibold">{simulados.length} no total</span>
          </div>
          {simulados.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </span>
              <h3 className="mt-5 text-xl font-black">Seu histórico começa aqui</h3>
              <p className="text-slate-500 mt-2">Envie um PDF para criar seu primeiro simulado.</p>
              <Link href="/dashboard/novo" className="inline-flex items-center gap-2 mt-5 text-blue-700 font-bold">
                Criar agora <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">{visibleSimulados.map((simulado) => <HistoryRow key={simulado.id} simulado={simulado} canEdit={stats.isPro} />)}</div>
              {historyPageCount > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <button type="button" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={historyPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"><ChevronLeft className="h-4 w-4" /> Anterior</button>
                  <span className="text-sm font-bold text-slate-600">Página {historyPage} de {historyPageCount}</span>
                  <button type="button" onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))} disabled={historyPage === historyPageCount} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">Próxima <ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Próximos passos</p>
            <h2 className="mt-2 text-lg font-black">Mantenha o ritmo</h2>
            <div className="mt-4 space-y-2">
              {[
                { href: '/dashboard/hoje', label: 'Organizar meu dia', detail: 'Tarefas e revisões', icon: CalendarDays },
                { href: '/dashboard/relatorios', label: 'Ver desempenho', detail: 'Evolução e pontos de atenção', icon: BarChart3 },
                { href: '/dashboard/plano-estudos', label: 'Plano de estudos', detail: 'Sua agenda personalizada', icon: BookOpenCheck },
                { href: '/dashboard/caderno-erros', label: 'Revisar meus erros', detail: 'Fixação e revisão espaçada', icon: NotebookPen },
              ].map(({ href, label, detail, icon: Icon }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-blue-100 hover:bg-blue-50 dark:hover:border-blue-900 dark:hover:bg-blue-950/30">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-900/60 dark:group-hover:text-blue-200"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-black">{label}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</span></span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
        </div>

      </div>
    </DashboardShell>
  )
}

function HistoryRow({ simulado, canEdit }: { simulado: Simulado; canEdit: boolean }) {
  const completed = simulado.status === 'CONCLUIDO'
  const inProgress = simulado.status === 'EM_ANDAMENTO'
  const isReviewSession = simulado.pdfNome === 'Caderno de erros'
  return (
    <article className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6 lg:flex-row lg:items-center dark:hover:bg-slate-800/60">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${completed ? 'bg-emerald-50 text-emerald-600' : inProgress ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'}`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-extrabold truncate">{simulado.titulo}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {getQuestionText(simulado, completed, inProgress)}
        </p>
      </div>
      <span className={`self-start lg:self-auto px-3 py-1.5 rounded-lg text-sm font-black ${completed ? 'bg-emerald-50 text-emerald-700' : inProgress ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
        {completed ? `${Math.round(simulado.tentativa?.percentual || 0)}%` : inProgress ? 'Em andamento' : 'Não iniciado'}
      </span>
      <div className="flex flex-wrap gap-2">
        {!completed && !isReviewSession && canEdit && (
          <Link href={`/dashboard/simulado/${simulado.id}/editar`} className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold hover:border-blue-500 hover:text-blue-700">
            <Pencil className="w-4 h-4" /> Editar
          </Link>
        )}
        {completed && (
          <Link href={`/dashboard/simulado/${simulado.id}`} className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold hover:border-blue-500 hover:text-blue-700">
            <FileText className="w-4 h-4" /> Ver resultado
          </Link>
        )}
        <Link href={`/dashboard/simulado/${simulado.id}${completed ? '?retake=1' : ''}`} className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold hover:border-blue-500 hover:text-blue-700">
          {completed ? (
            <>
              <RefreshCw className="w-4 h-4" /> Refazer
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> {inProgress ? 'Continuar' : 'Iniciar'}
            </>
          )}
        </Link>
      </div>
    </article>
  )
}
