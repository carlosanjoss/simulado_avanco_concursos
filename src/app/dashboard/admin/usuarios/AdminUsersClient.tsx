'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Shield, Trash2, UserCheck, UserX, RotateCcw, LogOut, MailX } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers'
import AdminEngagementPanels from './AdminEngagementPanels'

type ManagedUser = {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  accountStatus: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  lastLoginAt: string | null
  monthlyUsage: number
  _count: { simulados: number; tentativas: number }
}

type Invite = { id: string; email: string; name: string | null; expiresAt: string; createdAt: string }

export default function AdminUsersClient() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invitePage, setInvitePage] = useState(1)
  const invitePageSize = 5
  const invitePageCount = Math.max(1, Math.ceil(invites.length / invitePageSize))
  const currentInvitePage = Math.min(invitePage, invitePageCount)
  const visibleInvites = invites.slice((currentInvitePage - 1) * invitePageSize, currentInvitePage * invitePageSize)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users?page=${page}&q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os usuários')
      setUsers(data.users)
      setInvites(data.invites)
      setPages(data.pagination.pages)
      setTotal(data.pagination.total)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function runAction(id: string, body: object, successMessage: string) {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ação não concluída')
      toast.success(successMessage)
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ação não concluída')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteUser(user: ManagedUser) {
    const confirmation = window.prompt(`Para excluir definitivamente ${user.name || user.email}, digite o e-mail completo:`)
    if (confirmation === null) return
    setBusyId(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmEmail: confirmation }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir o usuário')
      toast.success('Usuário e dados relacionados excluídos')
      if (data.warning) toast.warning('Conta excluída, mas a limpeza vetorial precisa ser verificada')
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o usuário')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelInvite(invite: Invite) {
    setBusyId(invite.id)
    try {
      const response = await fetch(`/api/admin/invites/${invite.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível cancelar o convite')
      toast.success('Convite cancelado')
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar o convite')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 pb-10 sm:p-6 lg:p-7">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><p className="text-blue-700 font-bold uppercase tracking-widest text-xs">Administração</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Usuários</h1><p className="text-slate-500 mt-1">Controle acessos, funções, consumo e exclusão de contas.</p></div>
        <label className="relative block w-full lg:w-96"><Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar por nome ou e-mail" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-600" /></label>
      </div>

      <section className="mt-7 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-200"><h2 className="text-xl font-black">Contas cadastradas</h2><p className="text-sm text-slate-500">{total} usuário{total === 1 ? '' : 's'} no total</p></div>
        <div className="dashboard-scrollbar max-h-[min(52vh,560px)] overflow-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-3">Usuário</th><th className="px-5 py-3">Acesso</th><th className="px-5 py-3">Uso</th><th className="px-5 py-3">Atividade</th><th className="px-5 py-3">Cadastro / acesso</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Carregando usuários...</td></tr> : users.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td></tr> : users.map((user) => {
                const disabled = busyId === user.id
                const isSelf = currentUser?.id === user.id
                return <tr key={user.id} className="align-top hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold">{user.name || 'Sem nome'} {isSelf && <span className="text-xs text-blue-700">(você)</span>}</p><p className="text-xs text-slate-500">{user.email}</p></td><td className="px-5 py-4"><div className="flex gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.accountStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{user.accountStatus === 'ACTIVE' ? 'Ativo' : 'Suspenso'}</span>{user.isAdmin && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Admin</span>}</div></td><td className="px-5 py-4"><strong>{user.monthlyUsage}</strong> gerações no mês</td><td className="px-5 py-4"><p>{user._count.simulados} simulados</p><p className="text-xs text-slate-500">{user._count.tentativas} tentativas</p></td><td className="px-5 py-4"><p>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</p><p className="text-xs text-slate-500">Último acesso: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'nunca'}</p></td><td className="px-5 py-4"><div className="flex flex-wrap justify-end gap-2">
                  <button disabled={disabled || isSelf} onClick={() => runAction(user.id, { action: 'set-status', status: user.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, user.accountStatus === 'ACTIVE' ? 'Usuário suspenso' : 'Usuário reativado')} className="admin-action" title={user.accountStatus === 'ACTIVE' ? 'Suspender' : 'Reativar'}>{user.accountStatus === 'ACTIVE' ? <UserX /> : <UserCheck />}</button>
                  <button disabled={disabled || isSelf} onClick={() => runAction(user.id, { action: 'set-role', isAdmin: !user.isAdmin }, user.isAdmin ? 'Acesso administrativo removido' : 'Usuário promovido a administrador')} className="admin-action" title={user.isAdmin ? 'Remover admin' : 'Tornar admin'}><Shield /></button>
                  <button disabled={disabled} onClick={() => runAction(user.id, { action: 'reset-usage' }, 'Uso mensal zerado')} className="admin-action" title="Zerar uso mensal"><RotateCcw /></button>
                  <button disabled={disabled} onClick={() => runAction(user.id, { action: 'revoke-sessions' }, 'Sessões revogadas')} className="admin-action" title="Revogar sessões"><LogOut /></button>
                  <button disabled={disabled || isSelf} onClick={() => deleteUser(user)} className="admin-action text-red-700 hover:bg-red-50" title="Excluir definitivamente"><Trash2 /></button>
                </div></td></tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">Anterior</button><span className="text-sm text-slate-500">Página {page} de {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">Próxima</button></div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-black">Convites pendentes</h2><p className="text-sm text-slate-500">{invites.length} link{invites.length === 1 ? '' : 's'} ativo{invites.length === 1 ? '' : 's'} que ainda não foram utilizados</p></div>{invites.length === 0 ? <p className="p-8 text-center text-slate-500">Nenhum convite pendente.</p> : <><div className="divide-y divide-slate-100">{visibleInvites.map((invite) => <div key={invite.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-bold">{invite.name || 'Sem nome'}</p><p className="text-sm text-slate-500">{invite.email} · expira em {new Date(invite.expiresAt).toLocaleString('pt-BR')}</p></div><button disabled={busyId === invite.id} onClick={() => cancelInvite(invite)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"><MailX className="h-4 w-4" /> Cancelar convite</button></div>)}</div>{invitePageCount > 1 && <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4"><button type="button" onClick={() => setInvitePage((value) => Math.max(1, value - 1))} disabled={currentInvitePage === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button><span className="text-sm font-bold text-slate-600">{currentInvitePage} de {invitePageCount}</span><button type="button" onClick={() => setInvitePage((value) => Math.min(invitePageCount, value + 1))} disabled={currentInvitePage === invitePageCount} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button></div>}</>}</section>

      <AdminEngagementPanels onInviteCreated={loadUsers} />

      <style jsx>{`.admin-action{display:inline-flex;width:2.35rem;height:2.35rem;align-items:center;justify-content:center;border-radius:.6rem;border:1px solid #cbd5e1;background:#fff}.admin-action:hover{background:#f1f5f9}.admin-action:disabled{opacity:.35;cursor:not-allowed}.admin-action :global(svg){width:1rem;height:1rem}`}</style>
    </div>
  )
}
