'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react'

type PaymentState = 'pending' | 'success' | 'failure'

export function PaymentStatusBanner({ initialState, active }: { initialState?: string; active: boolean }) {
  const router = useRouter()
  const state = (['pending', 'success', 'failure'].includes(initialState || '') ? initialState : undefined) as PaymentState | undefined
  const [timedOut, setTimedOut] = useState(false)
  const [checking, setChecking] = useState(false)

  async function refreshStatus() {
    setChecking(true)
    try {
      const response = await fetch('/api/billing/status?sync=1', { cache: 'no-store' })
      if (!response.ok) return false
      const payload = await response.json() as { active?: boolean }
      if (payload.active) {
        router.replace('/dashboard/assinatura?payment=success')
        router.refresh()
        return true
      }
      return false
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (state !== 'pending' || active) return
    let checks = 0
    let stopped = false
    let timer: number | undefined
    const check = async (): Promise<void> => {
      checks += 1
      try {
        const response = await fetch('/api/billing/status?sync=1', { cache: 'no-store' })
        if (!response.ok) throw new Error('STATUS_UNAVAILABLE')
        const payload = await response.json() as { active?: boolean }
        if (payload.active && !stopped) {
          stopped = true
          router.replace('/dashboard/assinatura?payment=success')
          router.refresh()
          return
        }
      } catch {
        // O próximo ciclo repete a consulta sem interromper a tela.
      }
      if (stopped) return
      if (checks >= 40) {
        setTimedOut(true)
        return
      }
      timer = window.setTimeout(() => void check(), 3_000)
    }
    void check()
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [active, router, state])

  if (!state) return null
  if (state === 'success' || (state === 'pending' && active)) {
    return <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-black">Pagamento confirmado e plano Pro ativo.</p><Link href="/dashboard" className="mt-2 inline-flex font-bold text-emerald-800 underline">Ir para o dashboard</Link></div></div>
  }
  if (state === 'failure') {
    return <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div><p className="font-black">O pagamento não foi concluído.</p><p className="mt-1 text-sm">Tente novamente ou escolha outra forma de pagamento na Nuvemshop.</p></div></div>
  }
  return <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><LoaderCircle className={`mt-0.5 h-5 w-5 shrink-0 text-amber-600 ${!timedOut ? 'animate-spin' : ''}`} /><div className="flex-1"><p className="font-black">Aguardando confirmação do pagamento...</p><p className="mt-1 text-sm">Conclua a compra na aba da Avanço Concursos e volte para cá. O plano será ativado somente depois da confirmação da Nuvemshop.</p>{timedOut && <><p className="mt-2 text-sm font-bold">A confirmação está demorando, mas o processamento continuará em segundo plano.</p><button type="button" onClick={() => void refreshStatus()} disabled={checking} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-black disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />Verificar novamente</button></>}</div></div>
}
