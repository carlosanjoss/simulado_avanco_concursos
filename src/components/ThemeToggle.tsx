'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'

  return <button
    type="button"
    onClick={toggleTheme}
    aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    title={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-800 ${showLabel ? 'px-4 py-2.5 text-sm' : 'h-10 w-10'}`}
  >
    {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-700" />}
    {showLabel && <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>}
  </button>
}
