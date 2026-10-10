'use client'

import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useAuth } from '@/components/providers'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setName(user?.name || '') }, [user?.name])

  async function updateName(event: FormEvent) {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-name', name }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      await refresh(); toast.success('Nome atualizado')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar') } finally { setSaving(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirmPassword) return toast.error('As novas senhas não coincidem')
    setSaving(true)
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      toast.success('Senha alterada. Entre novamente.'); router.push('/sign-in'); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a senha') } finally { setSaving(false) }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (!window.confirm('Esta ação exclui permanentemente simulados, tentativas e dados da conta. Deseja continuar?')) return
    setDeleting(true)
    try {
      const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword, confirmEmail: deleteEmail }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      router.push('/'); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a conta') } finally { setDeleting(false) }
  }

  return <DashboardShell><div className="mx-auto max-w-3xl p-4 pb-10 sm:p-6 lg:p-7"><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Sua conta</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Perfil</h1><p className="text-slate-500 mt-1">Atualize seus dados e sua senha de acesso.</p>
    <form onSubmit={updateName} className="mt-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"><h2 className="text-xl font-black">Dados pessoais</h2><div><label className="block text-sm font-bold mb-2" htmlFor="profile-name">Nome</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /></div><div><label className="block text-sm font-bold mb-2">E-mail</label><input value={user?.email || ''} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500" /></div><button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">Salvar dados</button></form>
    <form onSubmit={changePassword} className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"><h2 className="text-xl font-black">Alterar senha</h2><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" required autoComplete="current-password" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha (mínimo de 8 caracteres)" minLength={8} required autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar nova senha" minLength={8} required autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /><button disabled={saving} className="rounded-xl bg-[#06183d] px-5 py-3 font-bold text-white disabled:opacity-50">Alterar senha</button></form>
    <section className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm"><h2 className="text-xl font-black">Seus dados</h2><p className="mt-2 text-sm text-slate-600">Baixe uma cópia em JSON dos dados da sua conta, simulados, tentativas e histórico de uso.</p><a href="/api/account/export" className="mt-5 inline-flex rounded-xl border border-blue-700 px-5 py-3 font-bold text-blue-700">Exportar meus dados</a></section>
    <form onSubmit={deleteAccount} className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8 space-y-5"><div><h2 className="text-xl font-black text-red-900">Excluir conta</h2><p className="mt-2 text-sm text-red-800">A exclusão é permanente. Assinaturas ativas precisam ser canceladas antes pelo suporte.</p></div><input type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} placeholder={`Digite ${user?.email || 'seu e-mail'} para confirmar`} required className="w-full rounded-xl border border-red-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-red-500" /><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Senha atual" required autoComplete="current-password" className="w-full rounded-xl border border-red-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-red-500" /><button disabled={deleting} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50">{deleting ? 'Excluindo...' : 'Excluir minha conta definitivamente'}</button></form>
  </div></DashboardShell>
}
