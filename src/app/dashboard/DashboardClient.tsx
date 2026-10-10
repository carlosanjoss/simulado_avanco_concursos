'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/components/providers'
import { useState, useEffect } from 'react'
import { ArrowRight, BarChart3, CheckCircle2, Clock3, FilePlus2, FileText, Pencil, Play, RefreshCw, Target, MessageSquareWarning } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
  stats: { completed: number; average: number; answered: number; remaining: number | null; used: number; unlimited: boolean; limit: number | null }
  isAdmin: boolean
}

function getQuestionText(simulado: Simulado, completed: boolean, inProgress: boolean): string {
  const base = `${simulado.totalQuestoes} questoes `
  if (completed) {
    return base + `Concluido em ${format(new Date(simulado.tentativa!.concluidoEm!), 'dd/MM/yyyy', { locale: ptBR })}`
  }
  if (inProgress) {
    return base + `Em andamento - questao ${(simulado.tentativa?.currentIndex || 0) + 1}`
  }
  return base + `Criado em ${format(new Date(simulado.createdAt), 'dd/MM/yyyy', { locale: ptBR })}`
}

export default function DashboardClient({ simulados, stats, isAdmin }: DashboardClientProps) {
  const { user } = useAuth()
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      fetchFeedbacks()
    }
  }, [isAdmin])

  const fetchFeedbacks = async () => {
    setLoadingFeedbacks(true)
    try {
      const res = await fetch('/api/admin/feedbacks')
      if (res.ok) {
        const data = await res.json()
        setFeedbacks(data.feedbacks || [])
      }
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error)
    } finally {
      setLoadingFeedbacks(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setInviteMessage(null)
    setInviteLink(null)

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || undefined }),
      })

      const data = await res.json()

      if (res.ok) {
        setInviteLink(data.inviteUrl || null)
        if (data.emailSent) {
          setInviteMessage({ type: 'success', text: `Convite enviado por e-mail para ${inviteEmail.trim()}.` })
        } else if (data.emailError === 'EMAIL_NOT_CONFIGURED') {
          setInviteMessage({ type: 'success', text: 'Convite criado. E-mail não configurado — copie o link abaixo e envie manualmente.' })
        } else {
          setInviteMessage({ type: 'error', text: `Convite criado, mas o e-mail falhou: ${data.emailError || 'erro desconhecido'}. Copie o link abaixo e envie manualmente.` })
        }
        setInviteEmail('')
        setInviteName('')
      } else {
        setInviteMessage({ type: 'error', text: data.error || 'Erro ao enviar convite' })
      }
    } catch (error) {
      console.error('Erro ao enviar convite:', error)
      setInviteMessage({ type: 'error', text: 'Erro ao enviar convite' })
    } finally {
      setInviting(false)
    }
  }

  const statCards = [
    { label: 'Simulados realizados', value: stats.completed, icon: FileText, color: 'text-blue-700 bg-blue-50' },
    { label: 'Media de acertos', value: `${stats.average}%`, icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Questoes respondidas', value: stats.answered, icon: Target, color: 'text-amber-600 bg-amber-50' },
    { label: 'Disponíveis no mês', value: stats.unlimited ? 'Ilimitado' : `${stats.remaining} de ${stats.limit}`, icon: Clock3, color: 'text-rose-600 bg-rose-50' },
  ]

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#06183d] sm:text-3xl">Olá, {user?.name || 'Estudante'}! <span aria-hidden>👋</span></h1>
            <p className="text-slate-500 mt-1">Continue sua jornada de estudos. Cada questao e um passo adiante.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 min-w-[220px]">
            <div className="relative w-12 h-12 rounded-full border-[5px] border-slate-100">
              <span className="absolute inset-[-5px] rounded-full border-[5px] border-emerald-500 border-l-transparent" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Limite mensal</p>
              {stats.unlimited ? (
                <>
                  <p className="font-black">Geracoes ilimitadas</p>
                  <p className="text-xs text-slate-500">Conta de testes</p>
                </>
              ) : (
                <>
                  <p className="font-black">{stats.used} de {stats.limit} simulados</p>
                  <p className="text-xs text-slate-500">{stats.remaining} restante{stats.remaining === 1 ? '' : 's'} neste mês</p>
                </>
              )}
            </div>
          </div>
        </div>

        <section id="estatisticas" className="scroll-margin-top-20 grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </span>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="relative mt-6 flex min-h-[185px] items-center overflow-hidden rounded-2xl px-6 py-7 text-white avanco-navy avanco-grid sm:px-8">
          <div className="relative z-10 max-w-xl">
            <p className="text-[#ffc400] uppercase tracking-widest text-xs font-bold">Pratique com seu proprio material</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Crie um novo simulado</h2>
            <p className="text-blue-100 mt-2">Envie seu PDF e escolha a quantidade e a dificuldade das questões.</p>
            <Link href="/dashboard/novo" className="inline-flex items-center gap-2 bg-[#ffc400] text-[#06183d] rounded-xl px-6 py-3 font-black mt-6 hover:bg-yellow-300">
              <FilePlus2 className="w-5 h-5" /> Novo Simulado
            </Link>
          </div>
          <Image src="/images/quiz-study.png" alt="Notebook com simulado" width={650} height={490} className="absolute bottom-[-105px] right-[-20px] hidden h-auto w-[390px] opacity-95 md:block" />
        </section>

        <section id="historico" className="scroll-margin-top-20 mt-6 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Seus ultimos simulados</h2>
              <p className="text-sm text-slate-500">Historico real das suas atividades</p>
            </div>
            <span className="text-sm text-blue-700 font-semibold">{simulados.length} no total</span>
          </div>
          {simulados.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </span>
              <h3 className="text-xl font-black mt-5">Seu historico comeca aqui</h3>
              <p className="text-slate-500 mt-2">Envie um PDF para criar seu primeiro simulado.</p>
              <Link href="/dashboard/novo" className="inline-flex items-center gap-2 mt-5 text-blue-700 font-bold">
                Criar agora <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">{simulados.map((simulado) => <HistoryRow key={simulado.id} simulado={simulado} />)}</div>
          )}
        </section>

        {isAdmin && (
          <>
            <section className="scroll-margin-top-20 mt-6 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Convidar Usuário (Beta)</h2>
                  <p className="text-sm text-slate-500">Cadastre o e-mail do usuário para enviar convite de acesso</p>
                </div>
              </div>
              <form onSubmit={handleInvite} className="p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Nome (opcional)"
                    className="sm:w-52 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    disabled={inviting}
                  />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-mail do usuário (ex: usuario@exemplo.com)"
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    disabled={inviting}
                    required
                  />
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-6 py-3 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {inviting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      'Enviar Convite'
                    )}
                  </button>
                </div>
                {inviteMessage && (
                  <p className={`mt-3 text-sm ${inviteMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {inviteMessage.text}
                  </p>
                )}
                {inviteLink && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-600" />
                    <button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)} className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-lg hover:bg-white">Copiar link</button>
                  </div>
                )}
              </form>
            </section>
            <section id="feedbacks" className="scroll-margin-top-20 mt-6 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Feedbacks de Questoes</h2>
                  <p className="text-sm text-slate-500">Relatos enviados pelos usuarios sobre questoes</p>
                </div>
              </div>
              <div className="dashboard-scrollbar max-h-[min(50vh,460px)] divide-y divide-slate-100 overflow-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="bg-slate-50 text-left text-sm font-semibold text-slate-600">
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3">Simulado</th>
                      <th className="px-4 py-3">Questao</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Mensagem</th>
                      <th className="px-4 py-3">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFeedbacks ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Carregando feedbacks...
                        </td>
                      </tr>
                    ) : feedbacks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Nenhum feedback reportado ainda.
                        </td>
                      </tr>
                    ) : (
                      feedbacks.map((feedback) => (
                        <tr key={feedback.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {feedback.user?.imageUrl && (
                                <Image
                                  src={feedback.user.imageUrl}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <div>
                                <p className="font-medium">{feedback.user?.name || 'Usuario'}</p>
                                <p className="text-xs text-slate-500">{feedback.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium truncate max-w-[200px]">{feedback.simulado?.titulo}</p>
                            <p className="text-xs text-slate-500">{feedback.simulado?.pdfNome}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">#{feedback.questaoId}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              feedback.type === 'incorrect_answer' ? 'bg-red-100 text-red-700' :
                              feedback.type === 'unclear' ? 'bg-amber-100 text-amber-700' :
                              feedback.type === 'not_in_document' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {feedback.type === 'incorrect_answer' && 'Resposta incorreta'}
                              {feedback.type === 'unclear' && 'Incompreensivel'}
                              {feedback.type === 'not_in_document' && 'Nao esta no documento'}
                              {feedback.type === 'other' && 'Outro'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <p className="truncate max-w-[300px] text-slate-700">
                              {feedback.message || 'Sem mensagem'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(feedback.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

function HistoryRow({ simulado }: { simulado: Simulado }) {
  const completed = simulado.status === 'CONCLUIDO'
  const inProgress = simulado.status === 'EM_ANDAMENTO'
  const isReviewSession = simulado.pdfNome === 'Caderno de erros'
  return (
    <article className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-slate-50 transition-colors">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${completed ? 'bg-emerald-50 text-emerald-600' : inProgress ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'}`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-extrabold truncate">{simulado.titulo}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {getQuestionText(simulado, completed, inProgress)}
        </p>
      </div>
      <span className={`self-start lg:self-auto px-3 py-1.5 rounded-lg text-sm font-black ${completed ? 'bg-emerald-50 text-emerald-700' : inProgress ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
        {completed ? `${Math.round(simulado.tentativa?.percentual || 0)}%` : inProgress ? 'Em andamento' : 'Nao iniciado'}
      </span>
      <div className="flex flex-wrap gap-2">
        {!completed && !isReviewSession && (
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
