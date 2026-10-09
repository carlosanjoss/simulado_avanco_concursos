'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import { useState } from 'react'
import { BarChart3, BookOpen, CalendarDays, CreditCard, FilePlus2, Files, History, Home, LibraryBig, LogOut, Menu, NotebookTabs, ReceiptText, UserRound, Users, X } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/novo', label: 'Novo Simulado', icon: FilePlus2 },
  { href: '/dashboard#historico', label: 'Meus Simulados', icon: History },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/dashboard/materias', label: 'Matérias', icon: BookOpen },
  { href: '/dashboard/materiais', label: 'Meus materiais', icon: Files },
  { href: '/dashboard/questoes', label: 'Banco de Questões', icon: LibraryBig },
  { href: '/dashboard/planos', label: 'Planos de Estudo', icon: CalendarDays },
  { href: '/dashboard/caderno-erros', label: 'Caderno de erros', icon: NotebookTabs },
  { href: '/dashboard/assinatura', label: 'Minha assinatura', icon: CreditCard },
  { href: '/dashboard/perfil', label: 'Perfil', icon: UserRound },
]

export default function DashboardShell({ children, focusMode = false }: { children: React.ReactNode; focusMode?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, refresh } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    refresh()
    router.push('/sign-in')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    const path = href.split('#')[0]
    return path !== '/dashboard' && pathname.startsWith(path)
  }

  const visibleNavigation = user?.isAdmin
    ? [...navigation, { href: '/dashboard/admin/usuarios', label: 'Gerenciar usuários', icon: Users }, { href: '/dashboard/admin/financeiro', label: 'Assinaturas', icon: ReceiptText }]
    : navigation
  const navigationLinks = visibleNavigation.map(({ href, label, icon: Icon }) => {
    const active = isActive(href)
    return (
      <Link key={label} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
        <Icon className="w-5 h-5" />{label}
      </Link>
    )
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f8fd] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (focusMode) {
    return (
      <div className="min-h-screen bg-[#f4f7fc] text-[#06183d]">
        <header className="h-16 border-b border-slate-200 bg-white/95 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
          <Link href="/dashboard" aria-label="Voltar ao dashboard"><BrandLogo compact /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-blue-700">Modo simulado</span>
            <button onClick={handleSignOut} className="p-2 rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f8fd] text-[#06183d] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:flex avanco-navy-deep text-white min-h-screen sticky top-0 flex-col border-r border-white/10">
        <div className="h-20 px-6 flex items-center border-b border-white/10">
          <BrandLogo light />
        </div>
        <nav className="p-4 space-y-2 flex-1" aria-label="Navegação principal">
          {navigationLinks}
        </nav>
        <div className="p-5 border-t border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user.name || 'Estudante'}</p>
            <p className="text-xs text-blue-200 truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-7 flex items-center justify-between sticky top-0 z-30">
          <div className="lg:hidden"><BrandLogo compact /></div>
          <div className="hidden lg:block text-sm text-slate-500">Sua preparação em outro nível</div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm font-medium text-slate-700">{user.name || 'Estudante'}</span>
            <button onClick={handleSignOut} className="p-2 rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
          </div>
        </header>
        <main>{children}</main>
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#031b43] text-white z-40 grid grid-cols-3 px-2 py-2 shadow-2xl" aria-label="Navegação rápida">
          {navigation.slice(0, 3).map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} className="flex flex-col items-center gap-1 py-1 text-[11px]"><Icon className="w-5 h-5" />{label}</Link>
          ))}
        </nav>
        {mobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60" role="presentation" onClick={() => setMobileOpen(false)}>
          <aside className="w-[min(86vw,320px)] h-full avanco-navy-deep text-white p-4 shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu principal" onClick={(event) => event.stopPropagation()}>
            <div className="h-16 flex items-center justify-between border-b border-white/10 mb-4"><BrandLogo light /><button type="button" onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Fechar menu"><X className="w-5 h-5" /></button></div>
            <nav className="space-y-2">{navigationLinks}</nav>
          </aside>
        </div>}
      </div>
    </div>
  )
}
