import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, email: true, name: true, imageUrl: true, accountStatus: true, emailVerifiedAt: true,
      termsAcceptedAt: true, legalVersion: true, createdAt: true, updatedAt: true, lastLoginAt: true,
      subscription: { select: { provider: true, planCode: true, status: true, billingInterval: true, currentPeriodStart: true, currentPeriodEnd: true, lastPaidAt: true, canceledAt: true, createdAt: true, updatedAt: true } },
      monthlyUsage: { select: { monthKey: true, count: true, createdAt: true, updatedAt: true }, orderBy: { monthKey: 'asc' } },
      simulados: { select: { id: true, titulo: true, totalQuestoes: true, temasFoco: true, pdfNome: true, pdfHash: true, questoesJson: true, status: true, createdAt: true, updatedAt: true, deletedAt: true } },
      tentativas: { select: { id: true, simuladoId: true, respostas: true, pontuacao: true, totalQuestoes: true, percentual: true, currentIndex: true, selectedAnswers: true, concluidoEm: true, durationSeconds: true, createdAt: true, updatedAt: true } },
      feedbacks: { select: { id: true, simuladoId: true, questaoId: true, type: true, message: true, createdAt: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), formatVersion: 1, user }, null, 2)
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="avanco-dados-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } })
}
