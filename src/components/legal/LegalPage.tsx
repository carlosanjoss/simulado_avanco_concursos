import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-800"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/"><BrandLogo /></Link><Link href="/" className="text-sm font-bold text-blue-700">Voltar ao início</Link></div></header><main className="mx-auto max-w-4xl px-5 py-12"><article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-12"><h1 className="text-3xl font-black text-[#06183d] sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-slate-500">Última atualização: {updatedAt}</p><div className="legal-content mt-10 space-y-8 leading-7 text-slate-700">{children}</div></article></main></div>
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-xl font-black text-[#06183d]">{title}</h2><div className="space-y-3">{children}</div></section>
}
