import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mark-canceled') }),
  z.object({ action: z.literal('reactivate') }),
])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  const { id } = await params
  const subscription = await prisma.subscription.findUnique({ where: { id }, select: { id: true, userId: true, status: true, planCode: true, currentPeriodEnd: true } })
  if (!subscription) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  const canceled = parsed.data.action === 'mark-canceled'
  if (canceled && subscription.status !== 'ACTIVE') return NextResponse.json({ error: 'Somente assinaturas ativas podem ser canceladas' }, { status: 409 })
  if (!canceled && subscription.status !== 'CANCELED') return NextResponse.json({ error: 'Somente assinaturas canceladas podem ser reativadas' }, { status: 409 })
  if (!canceled && (!subscription.currentPeriodEnd || subscription.currentPeriodEnd <= new Date())) {
    return NextResponse.json({ error: 'O período pago expirou. Registre um novo pagamento para reativar o acesso.' }, { status: 409 })
  }
  await prisma.$transaction([
    prisma.subscription.update({ where: { id }, data: { status: canceled ? 'CANCELED' : 'ACTIVE', canceledAt: canceled ? new Date() : null } }),
    prisma.adminAuditLog.create({
      data: {
        actorUserId: admin.id,
        targetUserId: subscription.userId,
        action: canceled ? 'SUBSCRIPTION_MARKED_CANCELED' : 'SUBSCRIPTION_REACTIVATED',
        metadata: JSON.stringify({ subscriptionId: subscription.id, previousStatus: subscription.status, planCode: subscription.planCode }),
      },
    }),
  ])
  return NextResponse.json({ success: true })
}
