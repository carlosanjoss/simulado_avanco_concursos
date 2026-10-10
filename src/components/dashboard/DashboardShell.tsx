'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import { BarChart3, BookOpen, CalendarDays, CreditCard, FilePlus2, Files, History, Home, LibraryBig, LogOut, NotebookTabs, ReceiptText, UserRound, Users } from 'lucide-react'
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
  const navigationLinks = visibleSections.flatMap((section) => section.items).map(({ href, label, icon: Icon }) => {
    const active = isActive(href)
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition-colors ${active ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'}`}><Icon className="h-4 w-4" /><span>{label}</span></Link>
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
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#f5f8fd] text-[#06183d]">
      <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo compact />
          <div className="hidden h-7 w-px bg-slate-200 sm:block" />
          <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-700">Área do estudante</p><p className="truncate text-sm font-bold text-slate-800">{pageTitle}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right md:block"><p className="truncate text-sm font-bold text-slate-700">{user.name || 'Estudante'}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</div>
          <button onClick={handleSignOut} className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Sair"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </header>
      <nav className="dashboard-scrollbar flex h-[54px] shrink-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain border-b border-slate-200 bg-white px-4 sm:px-6" aria-label="Navegação principal">
        <Link href="/dashboard/novo" aria-current={pathname === '/dashboard/novo' ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-black transition-colors ${pathname === '/dashboard/novo' ? 'bg-[#ffc400] text-[#06183d] shadow-sm' : 'bg-amber-50 text-amber-900 hover:bg-[#ffc400]'}`}><FilePlus2 className="h-4 w-4" /> Criar simulado</Link>
        <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" aria-hidden />
        {navigationLinks}
      </nav>
      <main className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
    </div>
  )
}
