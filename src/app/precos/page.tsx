import Link from 'next/link'
import { Check, ExternalLink } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { getPublicPricing } from '@/lib/plans'

export default function PricingPage() {
  const pricing = getPublicPricing()
  return (
    <div className="min-h-screen bg-slate-50 text-[#06183d]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/"><BrandLogo /></Link><Link href="/sign-in" className="rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white">Entrar</Link></div></header>
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Planos</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Escolha como você quer avançar</h1><p className="mx-auto mt-4 max-w-2xl text-slate-600">Comece gratuitamente e faça upgrade quando precisar gerar mais simulados.</p></div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <PlanCard name="Grátis" price="R$ 0" description="Para experimentar o método" features={['2 simulados por mês', 'Quantidade configurável', 'Fontes e justificativas', 'Histórico de desempenho']} action={<Link href="/sign-up" className="block rounded-xl border border-blue-700 px-5 py-3 text-center font-black text-blue-700">Criar conta</Link>} />
          <PlanCard featured name="Pro" price={pricing.proMonthly.label === 'A definir' ? 'Preço em configuração' : `R$ ${pricing.proMonthly.label}/mês`} description={`Até ${pricing.proLimit} simulados por mês`} features={['Todos os recursos do plano Grátis', `Até ${pricing.proLimit} gerações mensais`, 'Ativação automática após pagamento', 'Acesso mantido até o fim do período pago', 'Suporte comercial']} action={<CheckoutActions monthly={pricing.proMonthly} annual={pricing.proAnnual} />} />
        </div>
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-950"><strong>Importante:</strong> faça a compra na Nuvemshop usando o mesmo e-mail cadastrado no Avanço Simulados. A liberação ocorre após a confirmação do pagamento.</div>
      </main>
    </div>
  )
}

function CheckoutActions({ monthly, annual }: { monthly: { label: string; url: string }; annual: { label: string; url: string } }) {
  if (!monthly.url && !annual.url) return <span className="block rounded-xl bg-slate-200 px-5 py-3 text-center font-black text-slate-500">Checkout em configuração</span>
  return <div className="grid gap-3">{monthly.url && <a href={monthly.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d]">Assinar mensal{monthly.label !== 'A definir' ? ` · R$ ${monthly.label}` : ''} <ExternalLink className="h-4 w-4" /></a>}{annual.url && <a href={annual.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-blue-700 px-5 py-3 font-black text-blue-700">Assinar anual{annual.label !== 'A definir' ? ` · R$ ${annual.label}` : ''} <ExternalLink className="h-4 w-4" /></a>}</div>
}

function PlanCard({ name, price, description, features, action, featured = false }: { name: string; price: string; description: string; features: string[]; action: React.ReactNode; featured?: boolean }) {
  return <article className={`relative rounded-3xl border bg-white p-8 shadow-sm ${featured ? 'border-blue-700 ring-2 ring-blue-100' : 'border-slate-200'}`}>{featured && <span className="absolute right-6 top-6 rounded-full bg-blue-700 px-3 py-1 text-xs font-black text-white">Mais recursos</span>}<h2 className="text-2xl font-black">{name}</h2><p className="mt-4 text-3xl font-black">{price}</p><p className="mt-2 text-sm text-slate-500">{description}</p><ul className="my-7 space-y-3">{features.map((feature) => <li key={feature} className="flex items-center gap-3 text-sm"><Check className="h-5 w-5 text-emerald-600" />{feature}</li>)}</ul>{action}</article>
}
