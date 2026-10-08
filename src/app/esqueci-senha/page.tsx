'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await response.json()
      setMessage(data.message || 'Se a conta existir, enviaremos as instruções por e-mail.')
    } catch {
      setMessage('Se a conta existir, enviaremos as instruções por e-mail.')
    } finally { setLoading(false) }
  }
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="w-full max-w-md"><div className="text-center mb-7"><Link href="/"><BrandLogo /></Link><h1 className="text-3xl font-black mt-7">Recuperar senha</h1><p className="text-slate-600 mt-2">Enviaremos um link válido por uma hora.</p></div><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">{message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}<div><label htmlFor="recovery-email" className="block text-sm font-bold mb-2">E-mail</label><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600" /></div><button disabled={loading || !ready} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Enviando...' : 'Enviar instruções'}</button><Link href="/sign-in" className="block text-center text-sm font-bold text-blue-700">Voltar ao login</Link></form></div></main>
}
