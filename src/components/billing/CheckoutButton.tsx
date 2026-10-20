'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, LoaderCircle, LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers'

type CheckoutButtonProps = {
  interval: 'MONTHLY' | 'ANNUAL'
  children: React.ReactNode
  className?: string
  priceLabel?: string
  autoOpen?: boolean
}

export function CheckoutButton({
  interval,
  children,
  className = '',
  priceLabel,
  autoOpen = false,
}: CheckoutButtonProps) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const requestKey = useRef<string | null>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const autoOpened = useRef(false)
  const intervalLabel = interval === 'ANNUAL' ? 'Plano Pro anual' : 'Plano Pro mensal'

  useEffect(() => {
    if (!autoOpen || autoOpened.current) return
    autoOpened.current = true
    setOpen(true)
  }, [autoOpen])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [loading, open])

  async function startCheckout() {
    if (loading || authLoading) return
    if (!user) {
      setOpen(false)
      router.push(`/sign-in?redirect=${encodeURIComponent(`/dashboard/assinatura?checkout=${interval}`)}`)
      return
    }

    setLoading(true)
    requestKey.current ||= globalThis.crypto?.randomUUID?.() || `${Date.now()}-${interval}`
    const checkoutWindow = window.open('about:blank', '_blank')
    if (checkoutWindow) checkoutWindow.opener = null

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey.current,
        },
        body: JSON.stringify({ billingInterval: interval }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; checkoutUrl?: string; pendingUrl?: string }
      if (response.status === 401) {
        checkoutWindow?.close()
        setOpen(false)
        router.push(`/sign-in?redirect=${encodeURIComponent(`/dashboard/assinatura?checkout=${interval}`)}`)
        return
      }
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error || 'Não foi possível iniciar o checkout.')

      if (checkoutWindow) {
        checkoutWindow.location.href = payload.checkoutUrl
        setOpen(false)
        router.push(payload.pendingUrl || '/dashboard/assinatura?payment=pending')
      } else {
        window.location.assign(payload.checkoutUrl)
      }
    } catch (error) {
      checkoutWindow?.close()
      toast.error(error instanceof Error ? error.message : 'Falha ao iniciar o checkout.')
      setLoading(false)
    }
  }

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={loading}
      aria-haspopup="dialog"
      className={className}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {loading ? 'Preparando pagamento...' : children}
    </button>

    {open && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#031b43]/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !loading) setOpen(false)
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`checkout-title-${interval}`}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-w-xl sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden rounded-t-[2rem] bg-gradient-to-br from-[#031b43] via-[#07347d] to-[#0867df] px-6 pb-7 pt-6 text-white sm:px-8">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#ffc400]/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-blue-100">
                <ShieldCheck className="h-4 w-4 text-[#ffc400]" /> Pagamento protegido
              </span>
              <h2 id={`checkout-title-${interval}`} className="mt-5 text-2xl font-black sm:text-3xl">Confirme seu upgrade</h2>
              <p className="mt-2 text-sm leading-relaxed text-blue-100">Revise o plano antes de seguir para o ambiente seguro da Avanço Concursos.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} disabled={loading} aria-label="Fechar" className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-50">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">Plano selecionado</p>
              <p className="mt-1 text-xl font-black text-[#06183d]">{intervalLabel}</p>
              <p className="mt-1 text-sm text-slate-600">Acesso por {interval === 'ANNUAL' ? '12 meses' : '1 mês'} após a confirmação.</p>
            </div>
            {priceLabel && priceLabel !== 'A definir' && <p className="shrink-0 text-right text-xl font-black text-[#06183d]">R$ {priceLabel}</p>}
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-700">
            <p className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Seu acesso Pro é liberado automaticamente depois que o pedido for confirmado.</p>
            <p className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />O Avanço Simulados não recebe nem armazena os dados completos do seu cartão.</p>
            <p className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />A página de assinatura continuará acompanhando o status do pagamento.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-black">Use o mesmo e-mail da sua conta</p>
            <p className="mt-1 break-all">{user?.email || 'Entre na sua conta antes de continuar.'}</p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              ref={confirmButton}
              type="button"
              onClick={startCheckout}
              disabled={loading || authLoading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffd22e] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading || authLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : user ? <ExternalLink className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
              {authLoading ? 'Verificando conta...' : loading ? 'Abrindo pagamento...' : user ? 'Ir para pagamento seguro' : 'Entrar para assinar'}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={loading} className="min-h-12 rounded-xl px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">Agora não</button>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">O pagamento abre em uma nova aba da loja Avanço Concursos. Esta página permanece aberta para confirmar a ativação.</p>
        </div>
      </section>
    </div>}
  </>
}
