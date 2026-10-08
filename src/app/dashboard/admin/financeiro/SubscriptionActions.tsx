'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function SubscriptionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function update(action: 'mark-canceled' | 'reactivate') {
    if (action === 'mark-canceled' && !window.confirm('Confirme somente depois de cancelar a recorrência no painel da Nuvemshop.')) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      toast.success(action === 'mark-canceled' ? 'Assinatura marcada como cancelada' : 'Assinatura reativada')
      router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao atualizar assinatura') } finally { setLoading(false) }
  }
  if (status === 'ACTIVE') return <button disabled={loading} onClick={() => update('mark-canceled')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Marcar cancelada</button>
  if (status === 'CANCELED') return <button disabled={loading} onClick={() => update('reactivate')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">Reativar</button>
  return <span className="text-xs text-slate-400">Sem ação manual</span>
}
