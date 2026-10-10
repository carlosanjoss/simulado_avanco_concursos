'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, Crown, FileCheck2, Layers3, LockKeyhole, MessageSquareText, NotebookTabs, PenLine, ScanText, ShieldCheck, Sparkles, Target, UploadCloud } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { useAuth } from '@/components/providers'

const benefits = [
  { icon: Sparkles, title: 'Rápido e prático', text: 'Gere um simulado completo em poucos minutos.' },
  { icon: Target, title: 'Foco personalizado', text: 'Escolha os tópicos que realmente deseja estudar.' },
  { icon: FileCheck2, title: 'Questões de qualidade', text: 'Quantidade e dificuldade ajustadas ao seu objetivo.' },
  { icon: MessageSquareText, title: 'Feedback imediato', text: 'Veja a resposta correta e a justificativa detalhada.' },
  { icon: ShieldCheck, title: 'Privacidade por padrão', text: 'O arquivo PDF original não é armazenado e seus materiais ficam protegidos por usuário.' },
]

const proFeatures = [
  { icon: ScanText, title: 'OCR integrado', text: 'Use também PDFs digitalizados ou com páginas em imagem.' },
  { icon: PenLine, title: 'Editor inteligente', text: 'Edite ou regenere uma questão sem recriar todo o simulado.' },
  { icon: BarChart3, title: 'Relatórios avançados', text: 'Compare evolução, temas, dificuldades e ritmo de estudo.' },
  { icon: CalendarDays, title: 'Plano sincronizado', text: 'Organize a semana com base nos conteúdos dos seus simulados.' },
  { icon: NotebookTabs, title: 'Revisão espaçada', text: 'Transforme erros em revisões programadas automaticamente.' },
  { icon: Layers3, title: 'Múltiplos materiais', text: 'Combine até cinco materiais no mesmo simulado.' },
]

const faq = [
  ['Meu PDF fica armazenado?', 'O arquivo PDF original não é armazenado. O texto processado e os vetores ficam na sua biblioteca para reutilização até você arquivar ou excluir o material.'],
  ['Como funciona o acesso?', 'Durante o beta, o acesso pode ser liberado por convite. Quando o cadastro público estiver ativo, você também poderá criar sua conta diretamente.'],
  ['Quantas questões são geradas?', 'No plano Grátis, você escolhe 10 ou 20 questões. No Pro, também pode gerar 30, 40 ou 50 questões por simulado.'],
  ['Posso escolher os assuntos?', 'Sim. O campo de tópicos de foco permite priorizar conteúdos presentes no PDF.'],
  ['Quais PDFs são aceitos?', 'Arquivos PDF com texto extraível, até 20 MB e no máximo 400 páginas.'],
  ['O que o plano Pro libera?', 'O Pro aumenta o limite para 30 gerações mensais e inclui até 50 questões, OCR, editor e regeneração, relatórios avançados, plano de estudos, revisão espaçada, múltiplos materiais e banco completo de questões.'],
]

export default function LandingPage() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-white text-[#06183d]">
      <header className="h-20 bg-white/95 backdrop-blur border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-5 flex items-center justify-between">
          <Link href="/" aria-label="Página inicial"><BrandLogo /></Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <Link href="#inicio" className="text-blue-700">Início</Link>
            <Link href="#como-funciona" className="hover:text-blue-700">Como funciona</Link>
            <Link href="#recursos" className="hover:text-blue-700">Recursos</Link>
            <Link href="#planos" className="hover:text-blue-700">Planos</Link>
            <Link href="#seguranca" className="hover:text-blue-700">Segurança</Link>
            <Link href="#faq" className="hover:text-blue-700">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-semibold">Dashboard</Link>
            ) : (
              <Link href="/sign-in" className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-semibold">Entrar</Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section id="inicio" className="relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50">
          <div className="absolute right-0 top-0 w-[48%] h-full avanco-navy-deep hidden lg:block [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]" />
          <div className="max-w-7xl mx-auto px-5 py-16 lg:py-24 grid lg:grid-cols-[1fr_1.15fr] items-center gap-8 min-h-[650px] relative">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-900 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider"><Sparkles className="w-4 h-4" /> IA a favor da sua aprovação</span>
              <h1 className="text-5xl md:text-6xl lg:text-[68px] leading-[1.02] font-black tracking-tight mt-7">Transforme seus PDFs em <span className="text-blue-700 relative">simulados<span className="absolute h-1.5 bg-[#ffc400] left-0 right-0 -bottom-1 -rotate-1 rounded-full" /></span> inteligentes</h1>
              <p className="text-lg text-slate-600 max-w-xl mt-7 leading-relaxed">Envie seus materiais de estudo e receba questões personalizadas com inteligência artificial. Estude de forma prática, objetiva e focada no que realmente importa.</p>
              <div className="mt-9 flex flex-wrap gap-4">
                {user ? (
                  <Link href="/dashboard/novo" className="bg-blue-700 hover:bg-blue-800 text-white px-7 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-blue-200">Criar novo simulado <ArrowRight className="w-5 h-5" /></Link>
                ) : (
                  <Link href="/sign-in" className="bg-blue-700 hover:bg-blue-800 text-white px-7 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-blue-200">Entrar <ArrowRight className="w-5 h-5" /></Link>
                )}
                <Link href="#planos" className="px-7 py-4 rounded-xl border border-slate-300 font-bold hover:bg-slate-50">Conhecer o Pro</Link>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">Comece grátis com 2 gerações por mês e até 20 questões por simulado.</p>
              <div className="mt-10 flex items-center gap-3 text-sm text-slate-600"><CheckCircle2 className="h-6 w-6 text-emerald-500" /><p><strong className="text-[#06183d]">Questões rastreáveis</strong><br />com página e trecho do material usado</p></div>
            </div>
            <div className="relative z-10 min-h-[420px] lg:min-h-[540px] flex items-center justify-center">
              <Image src="/images/hero-study.png" alt="Livros, plano de estudos e notebook com o Avanço Simulados" width={1450} height={1080} className="w-full max-w-[760px] h-auto object-contain drop-shadow-2xl" priority />
            </div>
          </div>
        </section>

        <section id="recursos" className="border-y border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-5 py-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">{benefits.map(({ icon: Icon, title, text }) => <article key={title} className="flex lg:block gap-4 lg:text-center p-4"><div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center lg:mx-auto mb-3"><Icon className="w-6 h-6" /></div><div><h2 className="font-extrabold">{title}</h2><p className="text-sm text-slate-500 mt-1">{text}</p></div></article>)}</div>
        </section>

        <section id="como-funciona" className="py-24 bg-[#f7f9fd]">
          <div className="max-w-6xl mx-auto px-5 text-center"><span className="text-xs uppercase tracking-[.2em] text-blue-700 font-bold">Como funciona</span><h2 className="text-4xl font-black mt-3">Do seu PDF ao simulado em <span className="text-[#8a5a00]">3 passos</span></h2><p className="text-slate-600 mt-3">Uma experiência simples para você dedicar tempo ao que importa: estudar.</p>
            <div className="grid md:grid-cols-3 gap-6 mt-14">{[
              [UploadCloud,'Envie seu material','Selecione um PDF de até 20 MB e 400 páginas e informe os tópicos que deseja priorizar.'],
              [Sparkles,'A IA cria o simulado','O conteúdo é analisado e transformado na quantidade de questões que você escolher.'],
              [BarChart3,'Estude e evolua','Responda, receba feedback imediato e acompanhe seu desempenho.'],
            ].map(([Icon,title,text], index) => { const I = Icon as typeof UploadCloud; return <article key={String(title)} className="relative bg-white border border-slate-200 rounded-2xl p-8 avanco-shadow"><span className="absolute -top-4 left-6 w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">{index+1}</span><I className="w-12 h-12 text-blue-700 mx-auto mt-2" /><h3 className="font-black text-xl mt-5">{String(title)}</h3><p className="text-slate-500 mt-3 leading-relaxed">{String(text)}</p></article>})}</div>
          </div>
        </section>

        <section id="planos" className="relative overflow-hidden bg-white py-24">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-50/80 to-transparent" />
          <div className="relative mx-auto max-w-7xl px-5">
            <div className="mx-auto max-w-3xl text-center"><span className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Grátis para começar. Pro para avançar.</span><h2 className="mt-3 text-4xl font-black sm:text-5xl">Escolha o ritmo da sua preparação</h2><p className="mt-4 text-lg text-slate-600">Experimente os simulados gratuitamente e libere a experiência completa quando quiser estudar com mais profundidade.</p></div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch">
              <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><p className="text-sm font-black uppercase tracking-[.16em] text-slate-500">Plano Grátis</p><h3 className="mt-3 text-3xl font-black">Comece sem pagar</h3><p className="mt-3 text-slate-600">Para conhecer o método com os recursos essenciais.</p><ul className="my-8 space-y-4">{['2 gerações por mês','Até 20 questões por simulado','Dificuldade configurável','Histórico básico de desempenho','Até 3 materiais ativos','Um material por simulado'].map((feature) => <li key={feature} className="flex gap-3 font-semibold text-slate-700"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-4 w-4" /></span>{feature}</li>)}</ul><Link href={user ? '/dashboard/novo' : '/sign-up'} className="mt-auto flex items-center justify-center rounded-xl border border-blue-700 px-6 py-3.5 font-black text-blue-700 hover:bg-blue-50">{user ? 'Criar simulado grátis' : 'Criar conta grátis'}</Link></article>

              <article className="relative flex flex-col overflow-hidden rounded-3xl bg-[#061b46] p-7 text-white shadow-2xl shadow-blue-200 sm:p-9"><div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-500/20 blur-2xl" /><span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-[#ffc400] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#06183d]"><Crown className="h-4 w-4" /> Experiência completa</span><h3 className="relative mt-5 text-3xl font-black">Avanço Pro</h3><p className="relative mt-3 text-blue-100">Mais simulados e ferramentas para transformar desempenho em rotina de aprovação.</p><ul className="relative my-8 grid gap-4 sm:grid-cols-2">{['30 gerações por mês','Até 50 questões','OCR para PDFs digitalizados','Editor e regeneração','Relatórios avançados','Plano de estudos','Caderno de erros','Até 5 materiais por simulado','Banco completo de questões'].map((feature) => <li key={feature} className="flex gap-3 text-sm font-bold"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ffc400] text-[#06183d]"><Check className="h-3.5 w-3.5" /></span>{feature}</li>)}</ul><Link href="/precos" className="relative mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-6 py-3.5 font-black text-[#06183d] hover:bg-yellow-300">Ver preços e assinar <ArrowRight className="h-5 w-5" /></Link></article>
            </div>

            <div className="mt-16"><div className="text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">O que você ganha com o Pro</p><h3 className="mt-3 text-3xl font-black">Ferramentas para estudar, corrigir e revisar</h3></div><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{proFeatures.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon className="h-5 w-5" /></span><h4 className="mt-4 text-lg font-black">{title}</h4><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></article>)}</div></div>
          </div>
        </section>

        <section className="py-24 bg-white"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-16 items-center"><Image src="/images/quiz-study.png" alt="Simulado interativo em notebook" width={1400} height={1050} className="w-full h-auto" /><div><span className="text-blue-700 font-bold uppercase tracking-widest text-xs">Preparação completa</span><h2 className="text-4xl md:text-5xl font-black mt-4">Estude com o que realmente importa</h2><p className="text-slate-600 text-lg mt-5">Questões contextualizadas, justificativas detalhadas e acompanhamento de desempenho em uma experiência criada para concursos, faculdade e certificações.</p><div className="mt-8 space-y-4">{['Simulados baseados no seu PDF','Dificuldade configurável','Até 20 questões no Grátis e 50 no Pro','Histórico básico ou relatórios avançados no Pro'].map(text => <div key={text} className="flex gap-3 items-center font-semibold"><CheckCircle2 className="w-6 h-6 text-emerald-500" />{text}</div>)}</div></div></div></section>

        <section id="seguranca" className="avanco-navy-deep avanco-grid text-white py-20"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 items-center gap-12"><div><span className="text-[#ffc400] font-bold uppercase tracking-widest text-xs">Privacidade em primeiro lugar</span><h2 className="text-4xl md:text-5xl font-black mt-4">Seus materiais em segurança</h2><p className="text-blue-100 text-lg mt-5 max-w-xl">O arquivo PDF original não é armazenado. O texto processado e os vetores ficam na sua biblioteca, isolados por usuário, para que você possa reutilizar o material até decidir arquivá-lo ou excluí-lo.</p><div className="grid sm:grid-cols-2 gap-4 mt-8">{['PDF original não armazenado','Exclusão pelo usuário','Acesso protegido','Simulados privados por usuário'].map(text => <div key={text} className="flex gap-3"><span className="w-6 h-6 rounded bg-[#ffc400] text-[#06183d] flex items-center justify-center"><Check className="w-4 h-4" /></span>{text}</div>)}</div></div><Image src="/images/security-study.png" alt="Proteção e segurança dos materiais" width={1280} height={1280} className="w-full max-w-[520px] mx-auto h-auto" /></div></section>

        <section id="faq" className="py-24 bg-white"><div className="max-w-3xl mx-auto px-5"><div className="text-center"><span className="text-blue-700 font-bold uppercase tracking-widest text-xs">Dúvidas frequentes</span><h2 className="text-4xl font-black mt-3">Tudo o que você precisa saber</h2></div><div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{faq.map(([question,answer]) => <details key={question} className="group py-5"><summary className="list-none cursor-pointer flex items-center justify-between font-bold text-lg">{question}<ChevronDown className="w-5 h-5 group-open:rotate-180 transition-transform" /></summary><p className="text-slate-600 mt-3 pr-8 leading-relaxed">{answer}</p></details>)}</div></div></section>

        <section id="cta" className="px-5 pb-20"><div className="max-w-6xl mx-auto rounded-3xl avanco-navy text-white p-10 md:p-14 text-center relative overflow-hidden"><LockKeyhole className="absolute -left-6 -bottom-8 w-40 h-40 text-white/5" /><h2 className="text-4xl font-black relative">Pronto para avançar nos seus estudos?</h2><p className="text-blue-100 mt-3 relative">Estude com questões do seu próprio material e acompanhe sua evolução.</p>{user ? (<Link href="/dashboard/novo" className="inline-block mt-7 bg-[#ffc400] text-[#06183d] px-8 py-4 rounded-xl font-black relative">Novo simulado</Link>) : (<Link href="/precos" className="inline-block mt-7 bg-[#ffc400] text-[#06183d] px-8 py-4 rounded-xl font-black relative">Conhecer planos</Link>)}</div></section>
      </main>

      <footer className="bg-[#02132f] text-blue-100"><div className="max-w-7xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-6"><BrandLogo light /><div className="flex flex-wrap justify-center gap-5 text-sm"><Link href="/precos">Preços</Link><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link></div><p className="text-sm">© 2026 Avanço Simulados.</p></div></footer>
    </div>
  )
}
