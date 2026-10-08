import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import type { Question } from '@/types/quiz'
import StudyPlanClient from './StudyPlanClient'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function StudyPlansPage() {
  // Ler token do cookie via headers
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')

  const simulados = await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { titulo: true, questoesJson: true },
  })

  const counts = new Map<string, number>()
  simulados.forEach((simulado) => (JSON.parse(simulado.questoesJson) as Question[]).forEach((question) => {
    const theme = question.tema?.trim() || simulado.titulo
    counts.set(theme, (counts.get(theme) || 0) + 1)
  }))
  const themes = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([theme]) => theme)

  return <DashboardShell><StudyPlanClient themes={themes} /></DashboardShell>
}
