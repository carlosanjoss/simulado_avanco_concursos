import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { getMonthlyUsage } from '@/lib/usage-limit'
import { getPublicPricing, isSubscriptionActive } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const cookie = (await headers()).get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')
  const [subscription, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    getMonthlyUsage(user.id, user.email),
  ])
  const pricing = getPublicPricing()
  const active = isSubscriptionActive(subscription)
  const renewalCanceled = subscription?.status === 'CANCELED' && active
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  return <DashboardShell><div className="mx-auto max-w-4xl p-4 pb-10 sm:p-6 lg:p-7"><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Conta comercial</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Minha assinatura</h1><div className={`mt-7 rounded-3xl border p-7 shadow-sm ${active ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="flex items-center gap-3"><CheckCircle2 className={`h-7 w-7 ${active ? 'text-emerald-600' : 'text-slate-400'}`} /><div><h2 className="text-2xl font-black">Plano {active ? 'Pro' : 'Grátis'}</h2><p className="text-sm text-slate-600">{usage.used} de {usage.limit} gerações usadas neste mês</p></div></div>{renewalCanceled && <p className="mt-5 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950">Renovação cancelada. Seu acesso Pro permanece ativo até o fim do período já pago.</p>}{active && subscription?.currentPeriodEnd && <p className="mt-5 text-sm text-slate-700">Período vigente até <strong>{subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}</strong>.</p>}</div>{!active && <section className="mt-6 rounded-3xl border border-blue-100 bg-white p-7"><h2 className="text-xl font-black">Fazer upgrade</h2><p className="mt-2 text-sm text-slate-600">A compra é concluída com segurança na Nuvemshop. Use o mesmo e-mail da sua conta.</p>{pricing.proMonthly.url || pricing.proAnnual.url ? <div className="mt-5 flex flex-wrap gap-3">{pricing.proMonthly.url && <a href={pricing.proMonthly.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black">Assinar mensal <ExternalLink className="h-4 w-4" /></a>}{pricing.proAnnual.url && <a href={pricing.proAnnual.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-700 px-5 py-3 font-black text-blue-700">Assinar anual <ExternalLink className="h-4 w-4" /></a>}</div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Checkout ainda não configurado.</p>}</section>}<section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7"><h2 className="text-xl font-black">Gerenciar ou cancelar</h2><p className="mt-2 text-sm text-slate-600">No lançamento inicial, alterações e cancelamentos são processados pelo suporte e pelo painel Nuvemshop. O autoatendimento será habilitado quando a plataforma disponibilizar esse fluxo para o comprador.</p>{supportEmail && <a href={`mailto:${supportEmail}?subject=Assinatura%20Avan%C3%A7o`} className="mt-4 inline-flex font-bold text-blue-700">Falar com o suporte</a>}</section></div></DashboardShell>
}
