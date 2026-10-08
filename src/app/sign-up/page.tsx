'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [tokenLoaded, setTokenLoaded] = useState(false)
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [verificationPending, setVerificationPending] = useState(false)
  const [verificationEmailSent, setVerificationEmailSent] = useState(true)
  const publicSignupEnabled = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true'

  // Lê o token direto da URL (sem useSearchParams) para a página renderizar completa no primeiro paint
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('token') || ''
    const bootstrap = new URLSearchParams(window.location.search).get('bootstrap') || ''
    setToken(fromUrl)
    setBootstrapToken(bootstrap)
    setTokenLoaded(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, token, bootstrapToken, termsAccepted }),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.verificationRequired) {
          setVerificationEmailSent(data.emailSent === true)
          setVerificationPending(true)
          return
        }
        // Navegação completa: garante que o AuthProvider releia o cookie e hidrate o dashboard
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(data.error || 'Não foi possível concluir o cadastro.')
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6"><BrandLogo /></Link>
          <h1 className="text-3xl font-black text-[#06183d]">Criar sua conta</h1>
          <p className="text-slate-600 mt-2">Complete seu cadastro para começar a criar simulados</p>
        </div>

        {verificationPending ? <div className={`bg-white border rounded-2xl p-8 shadow-sm text-center ${verificationEmailSent ? 'border-emerald-200' : 'border-amber-200'}`}><h2 className={`text-xl font-black ${verificationEmailSent ? 'text-emerald-800' : 'text-amber-900'}`}>{verificationEmailSent ? 'Confira seu e-mail' : 'Conta criada, mas o e-mail não foi enviado'}</h2><p className="mt-3 text-sm text-slate-600">{verificationEmailSent ? <>Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, você poderá entrar.</> : <>Sua conta foi criada. Na tela de login, use “Reenviar confirmação” para tentar novamente ou fale com o suporte.</>}</p><Link href="/sign-in" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Ir para o login</Link></div> : <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          {tokenLoaded && !token && !bootstrapToken && !publicSignupEnabled && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
              Este link não contém um convite válido. Solicite um novo convite ao administrador.
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">Nome</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required autoComplete="name" />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail{token ? ' (do convite)' : ''}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required autoComplete="email" />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required minLength={8} autoComplete="new-password" />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar senha</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required autoComplete="new-password" />
          </div>

          <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required className="mt-1" /><span>Li e aceito os <Link href="/termos" target="_blank" className="font-bold text-blue-700">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" className="font-bold text-blue-700">Política de Privacidade</Link>.</span></label>

          <button type="submit" disabled={loading || !termsAccepted || (!publicSignupEnabled && !token && !bootstrapToken)} className="w-full bg-blue-700 hover:bg-blue-800 text-white px-4 py-3.5 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? 'Criando conta...' : token || bootstrapToken ? 'Criar conta e entrar' : 'Criar conta'}
          </button>
        </form>}

        <p className="text-center text-sm text-slate-600 mt-6">
          Já tem conta? <Link href="/sign-in" className="text-blue-700 font-semibold">Entrar</Link>
        </p>
      </div>
    </main>
  )
}
