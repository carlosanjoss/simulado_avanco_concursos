import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { BookOpenCheck, BrainCircuit, CheckCircle2, Clock3, Crown, FileScan, Headphones, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { CheckoutButton } from '@/components/billing/CheckoutButton'
import { PaymentStatusBanner } from '@/components/billing/PaymentStatusBanner'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { getMonthlyUsage } from '@/lib/usage-limit'
import { getPublicPricing, isSubscriptionActive } from '@/lib/plans'

export const dynamic = 'force-dynamic'

type SubscriptionPageProps = {
  searchParams?: Promise<{ payment?: string; checkout?: string }>
}

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const cookie = (await headers()).get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')

  const queryPromise: Promise<{ payment?: string; checkout?: string }> = searchParams || Promise.resolve({})
  const [subscription, usage, query] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    getMonthlyUsage(user.id, user.email),
    queryPromise,
  ])
  const pricing = getPublicPricing()
  const active = isSubscriptionActive(subscription)
  const renewalCanceled = subscription?.status === 'CANCELED' && active
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  const usageLabel = usage.unlimited ? `${usage.used} gerações neste mês · uso ilimitado` : `${usage.used} de ${usage.limit} gerações usadas neste mês`
  const usagePercent = usage.limit && usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0

  return <DashboardShell>
    <div className="mx-auto max-w-6xl p-4 pb-12 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#031b43] via-[#07347d] to-[#0867df] p-7 text-white shadow-xl sm:p-9">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#ffc400]/15 blur-3xl" />
        <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-blue-200"><Crown className="h-4 w-4 text-[#ffc400]" /> Conta e benefícios</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Minha assinatura</h1>
            <p className="mt-3 max-w-xl leading-relaxed text-blue-100">Acompanhe seu plano, consumo mensal e libere os recursos Pro para acelerar seus estudos.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Plano atual</p>
            <p className="mt-1 text-2xl font-black">{active ? 'Pro' : 'Grátis'}</p>
          </div>
        </div>
      </section>
      <PaymentStatusBanner initialState={query.payment} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className={`rounded-3xl border p-7 shadow-sm ${active ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><CheckCircle2 className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black">Plano {active ? 'Pro' : 'Grátis'}</h2>
              <p className="mt-1 text-sm text-slate-600">{usageLabel}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${active ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${usagePercent}%` }} />
              </div>
            </div>
          </div>
          {renewalCanceled && <p className="mt-5 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950">Seu acesso Pro permanece ativo até o fim do período já pago.</p>}
          {active && subscription?.currentPeriodEnd && <p className="mt-5 flex items-center gap-2 text-sm text-slate-700"><Clock3 className="h-4 w-4" />Acesso vigente até <strong>{subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}</strong>.</p>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-blue-700" /><h2 className="text-lg font-black">Pagamento protegido</h2></div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">Os dados de pagamento são tratados pela Nuvemshop/Nuvem Pago. O Avanço recebe apenas a confirmação necessária para liberar seu acesso.</p>
        </section>
      </div>

      {!active && <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Upgrade Pro</p><h2 className="mt-2 text-2xl font-black">Escolha o período de acesso</h2><p className="mt-2 text-sm text-slate-600">Você revisará tudo em uma janela antes de seguir para o pagamento seguro.</p></div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"><ShieldCheck className="h-4 w-4" /> Ativação automática</span>
        </div>
        {pricing.proMonthly.url || pricing.proAnnual.url ? <div className="mt-7 grid gap-4 md:grid-cols-2">
          {pricing.proMonthly.url && <article className="rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300 hover:shadow-md"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Mensal</p><p className="mt-2 text-2xl font-black">R$ {pricing.proMonthly.label}</p><p className="mt-1 text-sm text-slate-500">1 mês de acesso Pro</p><CheckoutButton interval="MONTHLY" priceLabel={pricing.proMonthly.label} autoOpen={query.checkout === 'MONTHLY'} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] transition hover:bg-[#ffd22e] disabled:cursor-wait disabled:opacity-70">Escolher mensal</CheckoutButton></article>}
          {pricing.proAnnual.url && <article className="relative rounded-2xl border-2 border-blue-700 bg-blue-50/40 p-5 shadow-sm"><span className="absolute right-4 top-4 rounded-full bg-blue-700 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">Mais praticidade</span><p className="text-xs font-black uppercase tracking-wider text-blue-700">Anual</p><p className="mt-2 text-2xl font-black">R$ {pricing.proAnnual.label}</p><p className="mt-1 text-sm text-slate-500">12 meses de acesso Pro</p><CheckoutButton interval="ANNUAL" priceLabel={pricing.proAnnual.label} autoOpen={query.checkout === 'ANNUAL'} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">Escolher anual</CheckoutButton></article>}
        </div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Checkout ainda não configurado.</p>}
      </section>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([
          [FileScan, 'OCR inteligente', 'Use também materiais digitalizados.'],
          [BrainCircuit, 'Relatórios avançados', 'Entenda lacunas e evolução.'],
          [BookOpenCheck, 'Plano de estudos', 'Organize tarefas e revisões.'],
          [Sparkles, 'Até 50 questões', 'Monte simulados mais completos.'],
        ] as [LucideIcon, string, string][]).map(([Icon, title, description]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className="h-5 w-5 text-blue-700" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></article>)}
      </section>

      <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div><div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black">Precisa de ajuda com seu acesso?</h2></div><p className="mt-2 text-sm text-slate-600">Compras, reembolsos e ajustes são conferidos pelo suporte com os dados do pedido.</p></div>
        {supportEmail && <a href={`mailto:${supportEmail}?subject=Assinatura%20Avan%C3%A7o`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 px-5 py-3 font-black text-blue-700 transition hover:bg-blue-50">Falar com o suporte</a>}
      </section>
    </div>
  </DashboardShell>
}
