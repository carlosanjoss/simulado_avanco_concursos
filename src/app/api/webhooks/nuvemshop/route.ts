import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { fetchNuvemshopOrder, nextSubscriptionPeriodEnd, verifyNuvemshopWebhook } from '@/lib/nuvemshop'

export const dynamic = 'force-dynamic'

const eventSchema = z.object({
  store_id: z.union([z.string(), z.number()]),
  event: z.string().min(1).max(100),
  id: z.union([z.string(), z.number()]),
})

export async function POST(request: NextRequest) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  if (!verifyNuvemshopWebhook(request, parsed.data.store_id)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const eventKey = `${parsed.data.store_id}:${parsed.data.event}:${parsed.data.id}`
  let eventRecord
  try {
    eventRecord = await prisma.paymentEvent.create({
      data: {
        eventKey,
        eventType: parsed.data.event,
        providerOrderId: String(parsed.data.id),
      },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    eventRecord = await prisma.paymentEvent.findUnique({ where: { eventKey } })
    if (!eventRecord) return NextResponse.json({ error: 'Falha ao recuperar evento' }, { status: 500 })
    if (eventRecord.status === 'PROCESSED' || eventRecord.status === 'IGNORED') {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  const staleProcessingBefore = new Date(Date.now() - 5 * 60 * 1000)
  const claimed = await prisma.paymentEvent.updateMany({
    where: {
      id: eventRecord.id,
      OR: [
        { status: { in: ['RECEIVED', 'FAILED'] } },
        { status: 'PROCESSING', updatedAt: { lt: staleProcessingBefore } },
      ],
    },
    data: { status: 'PROCESSING', errorMessage: null },
  })
  if (claimed.count !== 1) {
    return NextResponse.json({ error: 'Evento já está em processamento' }, { status: 503, headers: { 'Retry-After': '30' } })
  }

  try {
    if (parsed.data.event !== 'order/paid') {
      await prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: { status: 'IGNORED', processedAt: new Date(), metadata: JSON.stringify({ reason: 'EVENT_NOT_ENTITLEMENT' }) },
      })
      return NextResponse.json({ received: true, ignored: true })
    }

    const order = await fetchNuvemshopOrder(parsed.data.id)
    if (!order.email || !order.plan || order.paymentStatus?.toLowerCase() !== 'paid') {
      await prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: 'IGNORED',
          processedAt: new Date(),
          metadata: JSON.stringify({ reason: 'UNMATCHED_ORDER', hasEmail: Boolean(order.email), hasPlan: Boolean(order.plan), paymentStatus: order.paymentStatus }),
        },
      })
      return NextResponse.json({ received: true, ignored: true })
    }

    const user = await prisma.user.findUnique({ where: { email: order.email } })
    if (!user) {
      await prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: { status: 'IGNORED', processedAt: new Date(), metadata: JSON.stringify({ reason: 'ACCOUNT_NOT_FOUND' }) },
      })
      return NextResponse.json({ received: true, accountMatched: false })
    }

    const current = await prisma.subscription.findUnique({ where: { userId: user.id } })
    const now = new Date()
    const periodEnd = nextSubscriptionPeriodEnd(order.plan.billingInterval, current?.currentPeriodEnd || null, now)
    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          planCode: order.plan.planCode,
          status: 'ACTIVE',
          billingInterval: order.plan.billingInterval,
          providerSubscriptionId: order.subscriptionId,
          providerCustomerId: order.customerId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastPaidAt: now,
        },
        update: {
          planCode: order.plan.planCode,
          status: 'ACTIVE',
          billingInterval: order.plan.billingInterval,
          providerSubscriptionId: order.subscriptionId || current?.providerSubscriptionId,
          providerCustomerId: order.customerId || current?.providerCustomerId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastPaidAt: now,
          canceledAt: null,
        },
      }),
      prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: {
          userId: user.id,
          status: 'PROCESSED',
          processedAt: now,
          errorMessage: null,
          metadata: JSON.stringify({ planCode: order.plan.planCode, billingInterval: order.plan.billingInterval, productId: order.plan.productId }),
        },
      }),
    ])
    return NextResponse.json({ received: true, accountMatched: true })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'NUVEMSHOP_PROCESSING_FAILED'
    await prisma.paymentEvent.update({ where: { id: eventRecord.id }, data: { status: 'FAILED', errorMessage: message } }).catch(() => undefined)
    console.error('Falha ao processar webhook Nuvemshop:', message)
    return NextResponse.json({ error: 'Falha temporária ao processar evento' }, { status: 500 })
  }
}
