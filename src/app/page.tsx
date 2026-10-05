'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown, FileCheck2, FileText, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles, Target, UploadCloud } from 'lucide-react';
import { BrandLogo } from '@/components/shared/BrandLogo';

const benefits = [
  { icon: Sparkles, title: 'Rápido e prático', text: 'Gere um simulado completo em poucos minutos.' },
  { icon: Target, title: 'Foco personalizado', text: 'Escolha os tópicos que realmente deseja estudar.' },
  { icon: FileCheck2, title: 'Questões de qualidade', text: '30 questões baseadas diretamente no seu material.' },
  { icon: MessageSquareText, title: 'Feedback imediato', text: 'Veja a resposta correta e a justificativa detalhada.' },
  { icon: ShieldCheck, title: '100% seguro', text: 'Seu PDF é processado e descartado após a geração.' },
];

const faq = [
  ['Meu PDF fica armazenado?', 'Não. O documento e seus vetores são usados apenas durante a geração e descartados ao final.'],
  ['Quantos simulados posso criar?', 'No plano gratuito, cada usuário pode gerar até dois simulados por mês.'],
  ['Quantas questões são geradas?', 'Todo simulado possui exatamente 30 questões variadas.'],
  ['Posso escolher os assuntos?', 'Sim. O campo de tópicos de foco permite priorizar conteúdos presentes no PDF.'],
  ['Quais PDFs são aceitos?', 'Arquivos PDF com texto extraível, até 20 MB e no máximo 400 páginas.'],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#06183d]">
      <header className="h-20 bg-white/95 backdrop-blur border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-5 flex items-center justify-between">
          <Link href="/" aria-label="Página inicial"><BrandLogo /></Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <Link href="#inicio" className="text-blue-700">Início</Link>
            <Link href="#como-funciona" className="hover:text-blue-700">Como funciona</Link>
            <Link href="#recursos" className="hover:text-blue-700">Recursos</Link>
            <Link href="#seguranca" className="hover:text-blue-700">Segurança</Link>
            <Link href="#faq" className="hover:text-blue-700">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal"><button className="hidden sm:block px-5 py-2.5 rounded-xl border border-blue-900 text-blue-950 font-semibold hover:bg-blue-50">Entrar</button></SignInButton>
              <SignUpButton mode="modal"><button className="px-5 py-2.5 rounded-xl bg-[#ffc400] text-[#06183d] font-bold hover:bg-yellow-400 shadow-sm">Começar agora</button></SignUpButton>
            </SignedOut>
            <SignedIn><Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-semibold">Dashboard</Link><UserButton afterSignOutUrl="/" /></SignedIn>
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
                <SignedOut><SignUpButton mode="modal"><button className="bg-blue-700 hover:bg-blue-800 text-white px-7 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-blue-200">Começar agora gratuitamente <ArrowRight className="w-5 h-5" /></button></SignUpButton></SignedOut>
                <SignedIn><Link href="/dashboard/novo" className="bg-blue-700 hover:bg-blue-800 text-white px-7 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-blue-200">Criar novo simulado <ArrowRight className="w-5 h-5" /></Link></SignedIn>
                <Link href="#como-funciona" className="px-7 py-4 rounded-xl border border-slate-300 font-bold hover:bg-slate-50">Ver como funciona</Link>
              </div>
              <div className="mt-10 flex items-center gap-4 text-sm text-slate-600"><div className="flex -space-x-2">{['C','A','J','M'].map((letter, index) => <span key={letter} className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold ${['bg-blue-700','bg-emerald-500','bg-amber-500','bg-indigo-500'][index]}`}>{letter}</span>)}</div><p><strong className="text-[#06183d]">+2.000 estudantes</strong><br />já estudam com mais foco</p></div>
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
              [Sparkles,'A IA cria o simulado','O conteúdo é analisado e transformado em 30 questões personalizadas.'],
              [BarChart3,'Estude e evolua','Responda, receba feedback imediato e acompanhe seu desempenho.'],
            ].map(([Icon,title,text], index) => { const I = Icon as typeof UploadCloud; return <article key={String(title)} className="relative bg-white border border-slate-200 rounded-2xl p-8 avanco-shadow"><span className="absolute -top-4 left-6 w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">{index+1}</span><I className="w-12 h-12 text-blue-700 mx-auto mt-2" /><h3 className="font-black text-xl mt-5">{String(title)}</h3><p className="text-slate-500 mt-3 leading-relaxed">{String(text)}</p></article>})}</div>
          </div>
        </section>

        <section className="py-24 bg-white"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-16 items-center"><Image src="/images/quiz-study.png" alt="Simulado interativo em notebook" width={1400} height={1050} className="w-full h-auto" /><div><span className="text-blue-700 font-bold uppercase tracking-widest text-xs">Preparação completa</span><h2 className="text-4xl md:text-5xl font-black mt-4">Estude com o que realmente importa</h2><p className="text-slate-600 text-lg mt-5">Questões contextualizadas, justificativas detalhadas e acompanhamento de desempenho em uma experiência criada para concursos, faculdade e certificações.</p><div className="mt-8 space-y-4">{['Simulados baseados no seu PDF','Nível médio e avançado','30 questões de múltipla escolha','Histórico e evolução do desempenho'].map(text => <div key={text} className="flex gap-3 items-center font-semibold"><CheckCircle2 className="w-6 h-6 text-emerald-500" />{text}</div>)}</div></div></div></section>

        <section id="seguranca" className="avanco-navy-deep avanco-grid text-white py-20"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 items-center gap-12"><div><span className="text-[#ffc400] font-bold uppercase tracking-widest text-xs">Privacidade em primeiro lugar</span><h2 className="text-4xl md:text-5xl font-black mt-4">Seus materiais em segurança</h2><p className="text-blue-100 text-lg mt-5 max-w-xl">O PDF é processado somente durante a criação do simulado. O arquivo, o texto e os vetores temporários não são armazenados.</p><div className="grid sm:grid-cols-2 gap-4 mt-8">{['Processamento temporário','PDF não armazenado','Acesso protegido pelo Clerk','Simulados privados por usuário'].map(text => <div key={text} className="flex gap-3"><span className="w-6 h-6 rounded bg-[#ffc400] text-[#06183d] flex items-center justify-center"><Check className="w-4 h-4" /></span>{text}</div>)}</div></div><Image src="/images/security-study.png" alt="Proteção e segurança dos materiais" width={1280} height={1280} className="w-full max-w-[520px] mx-auto h-auto" /></div></section>

        <section id="faq" className="py-24 bg-white"><div className="max-w-3xl mx-auto px-5"><div className="text-center"><span className="text-blue-700 font-bold uppercase tracking-widest text-xs">Dúvidas frequentes</span><h2 className="text-4xl font-black mt-3">Tudo o que você precisa saber</h2></div><div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{faq.map(([question,answer]) => <details key={question} className="group py-5"><summary className="list-none cursor-pointer flex items-center justify-between font-bold text-lg">{question}<ChevronDown className="w-5 h-5 group-open:rotate-180 transition-transform" /></summary><p className="text-slate-600 mt-3 pr-8 leading-relaxed">{answer}</p></details>)}</div></div></section>

        <section className="px-5 pb-20"><div className="max-w-6xl mx-auto rounded-3xl avanco-navy text-white p-10 md:p-14 text-center relative overflow-hidden"><LockKeyhole className="absolute -left-6 -bottom-8 w-40 h-40 text-white/5" /><h2 className="text-4xl font-black relative">Pronto para avançar nos seus estudos?</h2><p className="text-blue-100 mt-3 relative">Crie seu primeiro simulado gratuitamente e transforme leitura em prática.</p><SignedOut><SignUpButton mode="modal"><button className="mt-7 bg-[#ffc400] text-[#06183d] px-8 py-4 rounded-xl font-black relative">Criar meu primeiro simulado</button></SignUpButton></SignedOut><SignedIn><Link href="/dashboard/novo" className="inline-block mt-7 bg-[#ffc400] text-[#06183d] px-8 py-4 rounded-xl font-black relative">Novo simulado</Link></SignedIn></div></section>
      </main>

      <footer className="bg-[#02132f] text-blue-100"><div className="max-w-7xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-6"><BrandLogo light /><p className="text-sm">© 2026 Avanço Simulados. Estude com inteligência.</p></div></footer>
    </div>
  );
}
