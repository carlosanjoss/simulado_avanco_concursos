'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Confirmando seu endereço...')
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || ''
    fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => { setStatus(ok ? 'success' : 'error'); setMessage(ok ? 'E-mail confirmado. Sua conta está pronta.' : data.error || 'Não foi possível confirmar o e-mail.') })
      .catch(() => { setStatus('error'); setMessage('Não foi possível confirmar o e-mail.') })
  }, [])
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><BrandLogo /><h1 className="text-2xl font-black mt-7">Verificação de e-mail</h1><p className={`mt-4 rounded-xl p-4 text-sm ${status === 'error' ? 'bg-red-50 text-red-700' : status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>{status === 'success' && <Link href="/sign-in" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Entrar</Link>}</div></main>
}
