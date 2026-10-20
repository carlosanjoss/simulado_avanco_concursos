'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, LogIn } from 'lucide-react'

export function SignInForm({ onSuccess, autoFocus = false }: { onSuccess: () => void | Promise<void>; autoFocus?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [notice, setNotice] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setNeedsVerification(false)
    setLoading(true)
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Credenciais inválidas')
        setNeedsVerification(data.code === 'EMAIL_NOT_VERIFIED')
        return
      }
      await onSuccess()
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

  return <form onSubmit={handleSubmit} className="space-y-5">
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {needsVerification && <button type="button" onClick={resendVerification} className="text-sm font-bold text-blue-700">Reenviar confirmação de e-mail</button>}
    <div><label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">E-mail</label><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" required autoComplete="email" autoFocus={autoFocus} /></div>
    <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">Senha</label><Link href="/esqueci-senha" className="text-xs font-bold text-blue-700 hover:underline">Esqueci minha senha</Link></div><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" required autoComplete="current-password" /></div>
    <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3.5 font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Entrando...</> : <><LogIn className="h-5 w-5" /> Entrar</>}</button>
    <p className="text-center text-sm text-slate-600">Ainda não tem uma conta? <Link href="/sign-up" className="font-black text-blue-700 hover:underline">Começar grátis</Link></p>
  </form>
}
