'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import { useState } from 'react'
import { BarChart3, BookOpen, CalendarDays, ChevronRight, CreditCard, FilePlus2, Files, History, Home, LibraryBig, LogOut, Menu, NotebookTabs, ReceiptText, UserRound, Users, X } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'

const navigationSections = [
  { label: 'Visão geral', items: [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard#historico', label: 'Meus simulados', icon: History },
    { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
  ] },
  { label: 'Estudo', items: [
    { href: '/dashboard/materiais', label: 'Meus materiais', icon: Files },
    { href: '/dashboard/materias', label: 'Matérias', icon: BookOpen },
    { href: '/dashboard/questoes', label: 'Banco de questões', icon: LibraryBig },
    { href: '/dashboard/planos', label: 'Plano de estudos', icon: CalendarDays },
    { href: '/dashboard/caderno-erros', label: 'Caderno de erros', icon: NotebookTabs },
  ] },
  { label: 'Conta', items: [
    { href: '/dashboard/assinatura', label: 'Minha assinatura', icon: CreditCard },
    { href: '/dashboard/perfil', label: 'Perfil', icon: UserRound },
  ] },
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

  const visibleSections = user?.isAdmin
    ? [...navigationSections, { label: 'Administração', items: [
      { href: '/dashboard/admin/usuarios', label: 'Gerenciar usuários', icon: Users },
      { href: '/dashboard/admin/financeiro', label: 'Assinaturas', icon: ReceiptText },
    ] }]
    : navigationSections
  const currentPage = visibleSections
    .flatMap((section) => section.items)
    .find((item) => {
      const itemPath = item.href.split('#')[0]
      if (itemPath === '/dashboard') return item.href === '/dashboard' && pathname === '/dashboard'
      return pathname.startsWith(itemPath)
    })
  const pageTitle = pathname === '/dashboard/novo'
    ? 'Novo simulado'
    : pathname.startsWith('/dashboard/simulado/')
      ? 'Simulado'
      : currentPage?.label || 'Área do estudante'
  const navigationLinks = visibleSections.map((section) => (
    <section key={section.label} className="mb-3 last:mb-0">
      <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300/70">{section.label}</p>
      <div className="space-y-1">
        {section.items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${active ? 'bg-white text-blue-950 shadow-md shadow-blue-950/20' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}><Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-blue-700' : ''}`} /><span className="flex-1">{label}</span>{active && <ChevronRight className="h-4 w-4 text-blue-600" />}</Link>
        })}
      </div>
    </section>
  ))

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
    <div className="h-dvh overflow-hidden bg-[#f5f8fd] text-[#06183d] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden h-dvh overflow-hidden border-r border-white/10 text-white lg:flex lg:flex-col avanco-navy-deep">
        <div className="flex h-[72px] shrink-0 items-center border-b border-white/10 px-5">
          <BrandLogo light />
        </div>
        <div className="shrink-0 px-3 pt-4">
          <Link href="/dashboard/novo" className="flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-4 py-3 text-sm font-black text-[#06183d] shadow-lg shadow-slate-950/20 transition hover:bg-yellow-300">
            <FilePlus2 className="h-[18px] w-[18px]" /> Criar simulado
          </Link>
        </div>
        <nav className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Navegação principal">
          {navigationLinks}
        </nav>
        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user.name || 'Estudante'}</p>
            <p className="text-xs text-blue-200 truncate">{user.email}</p>
          </div>
          <button onClick={handleSignOut} className="ml-auto shrink-0 rounded-lg p-2 text-blue-100 transition hover:bg-white/10 hover:text-white" aria-label="Sair">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
            <div className="lg:hidden"><BrandLogo compact /></div>
            <div className="hidden min-w-0 lg:block"><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-700">Avanço Simulados</p><p className="truncate text-sm font-bold text-slate-800">{pageTitle}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-600 sm:block lg:hidden">{user.name || 'Estudante'}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700 lg:hidden">{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</div>
          </div>
        </header>
        <main className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
        {mobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60" role="presentation" onClick={() => setMobileOpen(false)}>
          <aside className="flex h-dvh w-[min(86vw,320px)] flex-col overflow-hidden text-white shadow-2xl avanco-navy-deep" role="dialog" aria-modal="true" aria-label="Menu principal" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 px-4"><BrandLogo light /><button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
            <div className="shrink-0 px-3 pt-4"><Link href="/dashboard/novo" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-4 py-3 text-sm font-black text-[#06183d]"><FilePlus2 className="h-[18px] w-[18px]" /> Criar simulado</Link></div>
            <nav className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Navegação principal">{navigationLinks}</nav>
            <div className="flex shrink-0 items-center gap-3 border-t border-white/10 p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold">{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name || 'Estudante'}</p><p className="truncate text-xs text-blue-200">{user.email}</p></div><button onClick={handleSignOut} className="ml-auto rounded-lg p-2 text-blue-100 hover:bg-white/10" aria-label="Sair"><LogOut className="h-[18px] w-[18px]" /></button></div>
          </aside>
        </div>}
      </div>
    </div>
  )
}
