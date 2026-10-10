import { BarChart3, BookOpen, FileText, Gauge, type LucideIcon } from 'lucide-react';
import { buildPerformanceGroups, type PerformanceGroup } from '@/lib/performance';
import type { PublicQuestion, QuestionEvaluation } from '@/types/quiz';

export function PerformanceBreakdown({ questions, evaluations, fallbackTheme }: { questions: PublicQuestion[]; evaluations: Record<number, QuestionEvaluation>; fallbackTheme: string }) {
  const byType = buildPerformanceGroups(questions, evaluations, 'tipo', fallbackTheme);
  const byTheme = buildPerformanceGroups(questions, evaluations, 'tema', fallbackTheme);
  const byDifficulty = buildPerformanceGroups(questions, evaluations, 'dificuldade', fallbackTheme);
  return <section className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><BarChart3 className="w-6 h-6" /></span><div><h2 className="text-xl sm:text-2xl font-black">Desempenho detalhado</h2><p className="text-sm text-slate-600">Identifique seus pontos fortes e os assuntos que merecem revisão.</p></div></div><div className="grid lg:grid-cols-3 gap-5 mt-7"><PerformancePanel title="Por tipo" icon={FileText} groups={byType} /><PerformancePanel title="Por dificuldade" icon={Gauge} groups={byDifficulty} /><PerformancePanel title="Por tema" icon={BookOpen} groups={byTheme} /></div></section>;
}

function PerformancePanel({ title, icon: Icon, groups }: { title: string; icon: LucideIcon; groups: PerformanceGroup[] }) {
  const renderGroup = (group: PerformanceGroup) => <div key={group.label}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-bold" title={group.label}>{group.label}</span><span className="font-black text-blue-700">{group.percentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${group.percentage >= 70 ? 'bg-emerald-500' : group.percentage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${group.percentage}%` }} /></div><p className="mt-1 text-xs text-slate-500">{group.correct} de {group.answered} acertos • {group.total} questões</p></div>;
  return <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-2"><Icon className="w-5 h-5 text-blue-700" /><h3 className="font-black">{title}</h3></div><div className="mt-5 space-y-4">{groups.slice(0, 8).map(renderGroup)}{groups.length > 8 && <details><summary className="cursor-pointer list-none rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-black text-blue-700">Mostrar mais {groups.length - 8}</summary><div className="mt-4 space-y-4">{groups.slice(8).map(renderGroup)}</div></details>}</div></div>;
}
