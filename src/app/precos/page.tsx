import Link from 'next/link'
import { ArrowLeft, Check, Crown, LockKeyhole, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { CheckoutButton } from '@/components/billing/CheckoutButton'
import { getPublicPricing } from '@/lib/plans'
import { ThemeToggle } from '@/components/ThemeToggle'

const freeFeatures = [
  '2 gerações por mês',
  'Até 20 questões por simulado',
  'Dificuldade configurável',
  'Histórico básico de desempenho',
  'Até 3 materiais ativos',
  'Um material por simulado',
]

const proFeatures = [
  'Até 50 questões por simulado',
  'OCR para PDFs digitalizados',
  'Editor e regeneração de questões',
  'Relatórios avançados',
  'Plano de estudos sincronizado',
  'Caderno de erros e revisão espaçada',
  'Múltiplos materiais por simulado',
  'Banco privado das suas questões',
]

export default function PricingPage() {
  const pricing = getPublicPricing()

  return <div className="min-h-screen bg-[#f4f7fb] text-[#06183d] dark:bg-[#071120] dark:text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0b1728]/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-7">
        <Link href="/" aria-label="Voltar para a página inicial"><BrandLogo /></Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/" className="hidden items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 sm:inline-flex"><ArrowLeft className="h-4 w-4" />Início</Link>
          <Link href="/sign-in" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800 sm:px-5">Entrar</Link>
        </div>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden bg-[#031b43] px-5 pb-28 pt-16 text-white sm:px-7 sm:pb-32 sm:pt-20">
        <div className="avanco-grid absolute inset-0 opacity-50" />
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-blue-100"><Sparkles className="h-4 w-4 text-[#ffc400]" /> Planos simples e transparentes</span>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">Estude no seu ritmo.<br /><span className="text-[#ffc400]">Avance quando precisar.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-blue-100 sm:text-lg">Comece gratuitamente. Escolha o Pro quando quiser mais gerações, ferramentas inteligentes e uma rotina de estudos completa.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-blue-100">
            <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" />Pagamento protegido</span>
            <span className="flex items-center gap-2"><Zap className="h-5 w-5 text-[#ffc400]" />Ativação automática</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-blue-200" />Sem dados de cartão no Avanço</span>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-16 grid max-w-6xl gap-6 px-5 pb-16 sm:px-7 lg:grid-cols-2">
        <PlanCard
          name="Grátis"
          eyebrow="Para começar"
          price="R$ 0"
          description="Conheça a plataforma e crie seus primeiros simulados."
          features={freeFeatures}
          action={<Link href="/sign-up" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-blue-700 px-5 py-3 text-center font-black text-blue-700 transition hover:bg-blue-50">Criar conta grátis</Link>}
        />
        <PlanCard
          featured
          name="Pro"
          eyebrow="Para acelerar"
          price={pricing.proMonthly.label === 'A definir' ? 'Preço em configuração' : `R$ ${pricing.proMonthly.label}`}
          description={`Até ${pricing.proLimit} gerações por mês e todos os recursos avançados.`}
          features={proFeatures}
          action={<CheckoutActions monthly={pricing.proMonthly} annual={pricing.proAnnual} />}
        />
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-20 sm:px-7">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h2 className="text-xl font-black">Como funciona o pagamento?</h2>
              <div className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-600 sm:grid-cols-3">
                <p><strong className="block text-[#06183d]">1. Confirme o plano</strong>Você revisa período e valor sem sair desta página.</p>
                <p><strong className="block text-[#06183d]">2. Pague com segurança</strong>A compra abre na loja Avanço Concursos, processada pela Nuvemshop.</p>
                <p><strong className="block text-[#06183d]">3. Receba o acesso</strong>O Pro é liberado após a confirmação usando o mesmo e-mail da conta.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
}

function CheckoutActions({ monthly, annual }: { monthly: { label: string; url: string }; annual: { label: string; url: string } }) {
  if (!monthly.url && !annual.url) return <span className="block rounded-xl bg-slate-100 px-5 py-3 text-center font-black text-slate-500">Checkout em configuração</span>

  return <div className="grid gap-3">
    {monthly.url && <CheckoutButton interval="MONTHLY" priceLabel={monthly.label} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 font-black text-[#06183d] transition hover:-translate-y-0.5 hover:bg-[#ffd22e] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0">Assinar mensal{monthly.label !== 'A definir' ? ` · R$ ${monthly.label}` : ''}</CheckoutButton>}
    {annual.url && <CheckoutButton interval="ANNUAL" priceLabel={annual.label} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-blue-700 px-5 py-3 font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70">Assinar anual{annual.label !== 'A definir' ? ` · R$ ${annual.label}` : ''}</CheckoutButton>}
  </div>
}

function PlanCard({ name, eyebrow, price, description, features, action, featured = false }: { name: string; eyebrow: string; price: string; description: string; features: string[]; action: React.ReactNode; featured?: boolean }) {
  return <article className={`relative flex flex-col overflow-hidden rounded-[2rem] border bg-white shadow-xl ${featured ? 'border-blue-600 ring-4 ring-blue-100' : 'border-slate-200'}`}>
    {featured && <div className="flex items-center justify-center gap-2 bg-blue-700 px-5 py-2.5 text-xs font-black uppercase tracking-[.16em] text-white"><Crown className="h-4 w-4 text-[#ffc400]" />Plano completo</div>}
    <div className="flex flex-1 flex-col p-7 sm:p-9">
      <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black">{name}</h2>
      <p className="mt-5 text-4xl font-black tracking-tight">{price}</p>
      <p className="mt-3 min-h-12 leading-relaxed text-slate-500">{description}</p>
      <ul className="my-8 grid gap-3 sm:grid-cols-2">
        {features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>{feature}</li>)}
      </ul>
      <div className="mt-auto">{action}</div>
    </div>
  </article>
}
