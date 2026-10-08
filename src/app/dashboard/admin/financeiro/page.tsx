import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { isSubscriptionActive } from '@/lib/plans'
import SubscriptionActions from './SubscriptionActions'

export const dynamic = 'force-dynamic'

export default async function AdminBillingPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  if (!user.isAdmin) redirect('/dashboard')

  const [subscriptions, failed, unmatched, events] = await Promise.all([
    prisma.subscription.findMany({
      take: 100,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.paymentEvent.count({ where: { status: 'FAILED' } }),
    prisma.paymentEvent.count({ where: { status: 'IGNORED' } }),
    prisma.paymentEvent.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    }),
  ])
  const entitled = subscriptions.filter((subscription) => isSubscriptionActive(subscription)).length

  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl p-5 pb-24 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Administração</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Assinaturas e pagamentos</h1>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Metric label="Contas com acesso Pro" value={entitled} tone="emerald" />
          <Metric label="Eventos com falha" value={failed} tone="red" />
          <Metric label="Eventos não vinculados" value={unmatched} tone="amber" />
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-black">Assinaturas</h2>
            <p className="text-sm text-slate-500">Antes de marcar uma assinatura como cancelada aqui, cancele a recorrência no painel da Nuvemshop. O acesso pago continua até o fim do período vigente.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Plano</th><th className="px-5 py-3">Situação</th><th className="px-5 py-3">Período</th><th className="px-5 py-3">Último pagamento</th><th className="px-5 py-3">Ação</th></tr></thead>
              <tbody>{subscriptions.map((subscription) => {
                const hasAccess = isSubscriptionActive(subscription)
                return <tr key={subscription.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-bold">{subscription.user.name || 'Sem nome'}</p><p className="text-xs text-slate-500">{subscription.user.email}</p></td><td className="px-5 py-4">{subscription.planCode} {subscription.billingInterval ? `· ${subscription.billingInterval === 'ANNUAL' ? 'anual' : 'mensal'}` : ''}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${hasAccess ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{subscription.status === 'CANCELED' && hasAccess ? 'Cancelada · acesso vigente' : subscription.status}</span></td><td className="whitespace-nowrap px-5 py-4">{subscription.currentPeriodEnd ? `até ${subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}` : '—'}</td><td className="whitespace-nowrap px-5 py-4">{subscription.lastPaidAt ? subscription.lastPaidAt.toLocaleDateString('pt-BR') : '—'}</td><td className="px-5 py-4"><SubscriptionActions id={subscription.id} status={subscription.status} /></td></tr>
              })}</tbody>
            </table>
            {subscriptions.length === 0 && <p className="p-8 text-center text-slate-500">Nenhuma assinatura registrada.</p>}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-black">Últimos eventos da Nuvemshop</h2>
            <p className="text-sm text-slate-500">Use esta lista para identificar pagamentos sem conta correspondente e falhas de sincronização.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Data</th><th className="px-5 py-3">Evento</th><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Conta</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-5 py-4">{event.createdAt.toLocaleString('pt-BR')}</td><td className="px-5 py-4 font-mono text-xs">{event.eventType}</td><td className="px-5 py-4">{event.providerOrderId || '—'}</td><td className="px-5 py-4">{event.user?.email || 'Não vinculada'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.status === 'PROCESSED' ? 'bg-emerald-50 text-emerald-700' : event.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{event.status}</span></td></tr>)}</tbody></table>
            {events.length === 0 && <p className="p-8 text-center text-slate-500">Nenhum evento recebido.</p>}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'red' | 'amber' }) {
  const colors = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800', red: 'border-red-200 bg-red-50 text-red-800', amber: 'border-amber-200 bg-amber-50 text-amber-900' }
  return <article className={`rounded-2xl border p-5 ${colors[tone]}`}><p className="text-3xl font-black">{value}</p><p className="mt-1 text-sm font-bold">{label}</p></article>
}
