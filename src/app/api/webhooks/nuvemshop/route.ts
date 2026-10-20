import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  fetchNuvemshopOrder,
  getNuvemshopOrderDisposition,
  nextSubscriptionPeriodEnd,
  verifySecureNuvemshopWebhook,
} from '@/lib/nuvemshop'

export const dynamic = 'force-dynamic'

const supportedEvents = new Set(['order/paid', 'order/cancelled', 'order/voided'])
const eventSchema = z.object({
  store_id: z.union([z.string(), z.number()]),
  event: z.string().min(1).max(100),
  id: z.union([z.string(), z.number()]),
})

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const parsedJson = (() => {
    try { return JSON.parse(rawBody) as unknown } catch { return null }
  })()
  const parsed = eventSchema.safeParse(parsedJson)
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  if (!verifySecureNuvemshopWebhook(request, parsed.data.store_id, rawBody)) {
    return NextResponse.json({ error: 'Assinatura do webhook inválida' }, { status: 401 })
  }

  const orderId = String(parsed.data.id)
  const eventKey = `${parsed.data.store_id}:${parsed.data.event}:${orderId}`
  let eventRecord
  try {
    eventRecord = await prisma.paymentEvent.create({
      data: { eventKey, eventType: parsed.data.event, providerOrderId: orderId },
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
    if (!supportedEvents.has(parsed.data.event)) {
      await ignoreEvent(eventRecord.id, 'EVENT_NOT_SUPPORTED')
      return NextResponse.json({ received: true, ignored: true })
    }

    // Nunca confiamos apenas no payload do webhook: o pedido é relido na API.
    const order = await fetchNuvemshopOrder(orderId)
    if (!order.plan) {
      await ignoreEvent(eventRecord.id, 'UNMATCHED_PRODUCT', { paymentStatus: order.paymentStatus })
      return NextResponse.json({ received: true, ignored: true })
    }

    if (parsed.data.event === 'order/paid') {
      if (!order.email || getNuvemshopOrderDisposition(order) !== 'ACTIVE') {
        await ignoreEvent(eventRecord.id, 'ORDER_NOT_PAID', {
          hasEmail: Boolean(order.email),
          paymentStatus: order.paymentStatus,
        })
        return NextResponse.json({ received: true, ignored: true })
      }

      const user = await prisma.user.findUnique({ where: { email: order.email } })
      if (!user) {
        await ignoreEvent(eventRecord.id, 'ACCOUNT_NOT_FOUND')
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
            providerOrderId: order.id,
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
            providerOrderId: order.id,
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
    }

    const subscription = await prisma.subscription.findUnique({ where: { providerOrderId: order.id } })
    if (!subscription) {
      await ignoreEvent(eventRecord.id, 'ORDER_IS_NOT_CURRENT_SUBSCRIPTION')
      return NextResponse.json({ received: true, ignored: true })
    }

    const now = new Date()
    const disposition = getNuvemshopOrderDisposition(order)
    const revokeImmediately = disposition === 'REVOKED'
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: now,
          currentPeriodEnd: revokeImmediately ? now : subscription.currentPeriodEnd,
        },
      }),
      prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: {
          userId: subscription.userId,
          status: 'PROCESSED',
          processedAt: now,
          errorMessage: null,
          metadata: JSON.stringify({ disposition, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus }),
        },
      }),
    ])
    return NextResponse.json({ received: true, canceled: true, accessRevoked: revokeImmediately })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'NUVEMSHOP_PROCESSING_FAILED'
    await prisma.paymentEvent.update({ where: { id: eventRecord.id }, data: { status: 'FAILED', errorMessage: message } }).catch(() => undefined)
    console.error('Falha ao processar webhook Nuvemshop:', message)
    return NextResponse.json({ error: 'Falha temporária ao processar evento' }, { status: 500 })
  }
}

async function ignoreEvent(id: string, reason: string, metadata: Record<string, unknown> = {}) {
  await prisma.paymentEvent.update({
    where: { id },
    data: {
      status: 'IGNORED',
      processedAt: new Date(),
      metadata: JSON.stringify({ reason, ...metadata }),
    },
  })
}
