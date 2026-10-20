import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import type { Question } from '@/types/quiz'
import CurationClient from './CurationClient'

export const dynamic = 'force-dynamic'

export default async function CurationPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  if (!user.isAdmin) redirect('/dashboard')
  const entries = await prisma.questionBankEntry.findMany({
    where: { editorialStatus: { in: ['PENDING', 'CURATED', 'REJECTED'] } },
    orderBy: { updatedAt: 'desc' }, take: 200,
    include: { user: { select: { name: true, email: true } }, simulado: { select: { titulo: true, questoesJson: true } }, _count: { select: { versions: true } } },
  })
  const items = entries.flatMap((entry) => {
    try {
      const question = (JSON.parse(entry.simulado.questoesJson) as Question[]).find((item) => item.id === entry.questionId)
      if (!question) return []
      return [{ id: entry.id, owner: entry.user.name || entry.user.email, simulado: entry.simulado.titulo, question, status: entry.editorialStatus, sourceType: entry.sourceType, sourceName: entry.sourceName || '', licenseReference: entry.licenseReference || '', versionCount: entry._count.versions, updatedAt: entry.updatedAt.toISOString() }]
    } catch { return [] }
  })
  return <DashboardShell><CurationClient initialItems={items} /></DashboardShell>
}
