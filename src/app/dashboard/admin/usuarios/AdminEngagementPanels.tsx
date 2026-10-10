'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Copy, Loader2, MailPlus, MessageSquareText } from 'lucide-react'

type Feedback = {
  id: string
  questaoId: number
  type: 'incorrect_answer' | 'unclear' | 'not_in_document' | 'other'
  message: string | null
  createdAt: string
  user: { name: string | null; email: string; imageUrl: string | null }
  simulado: { titulo: string; pdfNome: string }
}

export default function AdminEngagementPanels({ onInviteCreated }: { onInviteCreated: () => void | Promise<void> }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFeedbacks() {
      setLoadingFeedbacks(true)
      setFeedbackError(null)
      try {
        const response = await fetch('/api/admin/feedbacks', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os feedbacks')
        setFeedbacks(data.feedbacks || [])
      } catch (error) {
        setFeedbackError(error instanceof Error ? error.message : 'Não foi possível carregar os feedbacks')
      } finally {
        setLoadingFeedbacks(false)
      }
    }
    void fetchFeedbacks()
  }, [])

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMessage(null)
    setInviteLink(null)
    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar convite')
      setInviteLink(data.inviteUrl || null)
      setInviteMessage({
        type: data.emailSent || data.emailError === 'EMAIL_NOT_CONFIGURED' ? 'success' : 'error',
        text: data.emailSent
          ? `Convite enviado por e-mail para ${inviteEmail.trim()}.`
          : data.emailError === 'EMAIL_NOT_CONFIGURED'
            ? 'Convite criado. E-mail não configurado — copie o link abaixo e envie manualmente.'
            : `Convite criado, mas o e-mail falhou: ${data.emailError || 'erro desconhecido'}. Copie o link abaixo.`,
      })
      setInviteEmail('')
      setInviteName('')
      await onInviteCreated()
    } catch (error) {
      setInviteMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao enviar convite' })
    } finally {
      setInviting(false)
    }
  }

  return <>
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MailPlus className="h-5 w-5" /></span>
        <div><h2 className="text-xl font-black">Convidar usuário</h2><p className="text-sm text-slate-500">Cadastre o e-mail para enviar um convite de acesso à plataforma.</p></div>
      </div>
      <form onSubmit={handleInvite} className="bg-slate-50 p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(280px,1fr)_auto]">
          <input type="text" value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Nome (opcional)" disabled={inviting} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
          <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="E-mail do usuário" disabled={inviting} required className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={inviting || !inviteEmail.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}{inviting ? 'Enviando...' : 'Enviar convite'}</button>
        </div>
        {inviteMessage && <p className={`mt-3 text-sm font-medium ${inviteMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>{inviteMessage.text}</p>}
        {inviteLink && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600" /><button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold hover:bg-slate-100"><Copy className="h-3.5 w-3.5" /> Copiar link</button></div>}
      </form>
    </section>

    <section id="feedbacks" className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><MessageSquareText className="h-5 w-5" /></span>
        <div><h2 className="text-xl font-black">Feedbacks de questões</h2><p className="text-sm text-slate-500">Relatos enviados pelos usuários sobre as questões dos simulados.</p></div>
      </div>
      <div className="dashboard-scrollbar max-h-[min(50vh,460px)] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left font-semibold text-slate-600"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Simulado</th><th className="px-4 py-3">Questão</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Mensagem</th><th className="px-4 py-3">Data</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loadingFeedbacks ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Carregando feedbacks...</td></tr>
              : feedbackError ? <tr><td colSpan={6} className="px-4 py-10 text-center text-red-600">{feedbackError}</td></tr>
                : feedbacks.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum feedback reportado ainda.</td></tr>
                  : feedbacks.map((feedback) => <tr key={feedback.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2">{feedback.user.imageUrl && <Image src={feedback.user.imageUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />}<div><p className="font-medium">{feedback.user.name || 'Usuário'}</p><p className="text-xs text-slate-500">{feedback.user.email}</p></div></div></td>
                    <td className="px-4 py-3"><p className="max-w-[200px] truncate font-medium">{feedback.simulado.titulo}</p><p className="text-xs text-slate-500">{feedback.simulado.pdfNome}</p></td>
                    <td className="px-4 py-3 font-mono">#{feedback.questaoId}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${feedback.type === 'incorrect_answer' ? 'bg-red-100 text-red-700' : feedback.type === 'unclear' ? 'bg-amber-100 text-amber-700' : feedback.type === 'not_in_document' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{feedback.type === 'incorrect_answer' ? 'Resposta incorreta' : feedback.type === 'unclear' ? 'Incompreensível' : feedback.type === 'not_in_document' ? 'Não está no documento' : 'Outro'}</span></td>
                    <td className="px-4 py-3"><p className="max-w-[300px] truncate text-slate-700">{feedback.message || 'Sem mensagem'}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(feedback.createdAt).toLocaleString('pt-BR')}</td>
                  </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </>
}
