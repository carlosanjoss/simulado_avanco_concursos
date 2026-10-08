'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'

function safeRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const target = new URLSearchParams(window.location.search).get('redirect')
  // Só aceita caminhos internos (evita open redirect)
  if (target && target.startsWith('/') && !target.startsWith('//')) return target
  return '/dashboard'
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [notice, setNotice] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNeedsVerification(false)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        const target = safeRedirect()
        // Navegação completa: garante que o AuthProvider releia o cookie e hidrate o dashboard
        window.location.href = target
      } else {
        setError(data.error || 'Credenciais inválidas')
        setNeedsVerification(data.code === 'EMAIL_NOT_VERIFIED')
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    setNotice('')
    await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setNotice('Se a conta precisar de confirmação, enviaremos um novo e-mail.')
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6"><BrandLogo /></Link>
          <h1 className="text-3xl font-black text-[#06183d]">Entrar</h1>
          <p className="text-slate-600 mt-2">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm">{notice}</div>}
          {needsVerification && <button type="button" onClick={resendVerification} className="text-sm font-bold text-blue-700">Reenviar confirmação de e-mail</button>}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5"><label htmlFor="password" className="block text-sm font-semibold text-slate-700">Senha</label><Link href="/esqueci-senha" className="text-xs font-bold text-blue-700">Esqueci minha senha</Link></div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white px-4 py-3.5 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

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
