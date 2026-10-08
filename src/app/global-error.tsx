'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import './globals.css'

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-[#06183d]">
          <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-red-600">Erro inesperado</p>
            <h1 className="mt-3 text-3xl font-black">Não foi possível carregar esta página</h1>
            <p className="mt-3 text-slate-600">O erro foi registrado para análise. Tente novamente ou volte para a página inicial.</p>
            {error.digest && <p className="mt-3 text-xs text-slate-400">Código de referência: {error.digest}</p>}
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => retry()} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Tentar novamente</button>
              <a href="/" className="rounded-xl border border-slate-300 px-5 py-3 font-bold">Ir para o início</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
