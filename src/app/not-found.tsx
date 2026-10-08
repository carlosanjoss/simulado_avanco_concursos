import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-[#06183d]">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Erro 404</p>
        <h1 className="mt-3 text-3xl font-black">Página não encontrada</h1>
        <p className="mt-3 text-slate-600">O endereço pode ter mudado ou não existe.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Voltar para o início</Link>
      </section>
    </main>
  )
}
