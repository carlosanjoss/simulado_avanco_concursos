'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setMessage('Senha alterada. Todas as sessões anteriores foram encerradas.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha.') } finally { setLoading(false) }
  }
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="w-full max-w-md"><div className="text-center mb-7"><Link href="/"><BrandLogo /></Link><h1 className="text-3xl font-black mt-7">Criar nova senha</h1></div><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">{error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message ? <><p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p><Link href="/sign-in" className="block rounded-xl bg-blue-700 px-5 py-3 text-center font-bold text-white">Entrar</Link></> : <><input type="password" minLength={8} maxLength={200} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha (mínimo de 8 caracteres)" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /><input type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirmar nova senha" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /><button disabled={loading || !token} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar nova senha'}</button></>}</form></div></main>
}
