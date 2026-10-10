'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import { useState } from 'react'
import { BarChart3, BookOpen, CalendarDays, ChevronDown, CreditCard, FilePlus2, Files, Home, LibraryBig, LogOut, Menu, NotebookTabs, ReceiptText, UserRound, Users, X } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'

const navigationSections = [
  { label: 'Visão geral', items: [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
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
  const mainItems = [
    navigationSections[0].items[0],
    navigationSections[1].items[0],
    navigationSections[0].items[1],
  ]
  const studyItems = [navigationSections[1].items[1], navigationSections[1].items[2], navigationSections[1].items[3], navigationSections[1].items[4]]
  const accountItems = navigationSections[2].items
  const adminItems = user?.isAdmin ? visibleSections.find((section) => section.label === 'Administração')?.items || [] : []
  const studyActive = studyItems.some((item) => isActive(item.href))
  const adminActive = adminItems.some((item) => isActive(item.href))

  const navLink = ({ href, label, icon: Icon }: typeof mainItems[number], mobile = false) => {
    const active = isActive(href)
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)} className={`${mobile ? 'flex items-center gap-3 rounded-xl px-4 py-3' : 'inline-flex items-center gap-2 rounded-lg px-3 py-2'} text-sm font-bold transition-colors ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className="h-4 w-4 shrink-0" /><span>{label}</span></Link>
  }

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
      <header className="relative z-30 flex h-[72px] shrink-0 items-center border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-5">
          <Link href="/dashboard" className="shrink-0" aria-label="Ir para o dashboard"><BrandLogo compact /></Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Navegação principal">
            {mainItems.map((item) => navLink(item))}
            <details className="group relative">
              <summary className={`flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition ${studyActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Estudar <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
              <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">{studyItems.map((item) => navLink(item, true))}</div>
            </details>
            {adminItems.length > 0 && <details className="group relative">
              <summary className={`flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition ${adminActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>Administração <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">{adminItems.map((item) => navLink(item, true))}</div>
            </details>}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link href="/dashboard/novo" className="hidden items-center gap-2 rounded-xl bg-[#ffc400] px-4 py-2.5 text-sm font-black text-[#06183d] shadow-sm transition hover:bg-yellow-300 sm:inline-flex"><FilePlus2 className="h-4 w-4" /> Criar simulado</Link>
            <details className="group relative hidden xl:block">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 transition hover:border-blue-200 hover:bg-blue-50" aria-label="Abrir menu da conta">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-black text-white">{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2.5"><p className="truncate text-sm font-bold text-slate-800">{user.name || 'Estudante'}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
                {accountItems.map((item) => navLink(item, true))}
                <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" /> Sair</button>
              </div>
            </details>
            <button type="button" onClick={() => setMobileOpen((open) => !open)} className="rounded-xl border border-slate-200 p-2.5 text-slate-700 transition hover:bg-slate-100 xl:hidden" aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}>{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>

        {mobileOpen && <div className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-4 shadow-xl xl:hidden">
          <div className="mx-auto grid max-w-4xl gap-1 sm:grid-cols-2">
            <Link href="/dashboard/novo" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-950 sm:hidden"><FilePlus2 className="h-4 w-4" /> Criar simulado</Link>
            {[...mainItems, ...studyItems, ...accountItems, ...adminItems].map((item) => navLink(item, true))}
            <button onClick={handleSignOut} className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
        </div>}
      </header>
      <main className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
    </div>
  )
}
