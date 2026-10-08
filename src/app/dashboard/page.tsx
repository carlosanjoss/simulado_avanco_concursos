import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'
import { getMonthlyUsage } from '@/lib/usage-limit'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Ler token do cookie via headers
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) {
    redirect('/sign-in')
  }

  const simulados = await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      titulo: true,
      totalQuestoes: true,
      temasFoco: true,
      pdfNome: true,
      status: true,
      createdAt: true,
      tentativas: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { pontuacao: true, percentual: true, concluidoEm: true, currentIndex: true },
      },
    },
  })

  const completedAttempts = await prisma.tentativa.findMany({
    where: { userId: user.id, concluidoEm: { not: null } },
    select: { percentual: true, totalQuestoes: true },
  })

  const usage = await getMonthlyUsage(user.id, user.email)
  const average = completedAttempts.length
    ? Math.round(completedAttempts.reduce((sum, attempt) => sum + attempt.percentual, 0) / completedAttempts.length)
    : 0

  return (
    <DashboardClient
      isAdmin={user.isAdmin ?? false}
      simulados={simulados.map((simulado) => ({
        id: simulado.id,
        titulo: simulado.titulo,
        totalQuestoes: simulado.totalQuestoes,
        temasFoco: simulado.temasFoco,
        pdfNome: simulado.pdfNome,
        status: simulado.status,
        createdAt: simulado.createdAt.toISOString(),
        tentativa: simulado.tentativas[0]
          ? { ...simulado.tentativas[0], concluidoEm: simulado.tentativas[0].concluidoEm?.toISOString() || null }
          : null,
      }))}
      stats={{
        completed: completedAttempts.length,
        average,
        answered: completedAttempts.reduce((sum, attempt) => sum + attempt.totalQuestoes, 0),
        remaining: usage.remaining,
        used: usage.used,
        unlimited: usage.unlimited,
        limit: usage.limit,
      }}
    />
  )
}
