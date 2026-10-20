'use client'

import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { SignInForm } from '@/components/auth/SignInForm'
import { ThemeToggle } from '@/components/ThemeToggle'

function safeRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const target = new URLSearchParams(window.location.search).get('redirect')
  // Só aceita caminhos internos (evita open redirect)
  if (target && target.startsWith('/') && !target.startsWith('//')) return target
  return '/dashboard'
}

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-white p-4 dark:bg-[#071120]">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6"><BrandLogo /></Link>
          <h1 className="text-3xl font-black text-[#06183d]">Entrar</h1>
          <p className="text-slate-600 mt-2">Acesse sua conta para continuar</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><SignInForm onSuccess={() => { window.location.href = safeRedirect() }} autoFocus /></div>

        <p className="text-center text-sm text-slate-600 mt-6">
          Acesso por convite. Fale com o administrador para receber seu link.
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">
          Primeiro acesso? Use o link pessoal recebido no convite.
        </p>
      </div>
    </main>
  )
}
