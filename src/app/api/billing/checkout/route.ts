import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'
import { getPublicPricing, isSubscriptionActive, type BillingInterval } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const checkoutSchema = z.object({
  planCode: z.enum(['MONTHLY', 'ANNUAL', 'MENSAL']).optional(),
  billingInterval: z.enum(['MONTHLY', 'ANNUAL']).optional(),
}).refine((value) => value.planCode || value.billingInterval, 'Selecione o plano')

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  const interval: BillingInterval = parsed.data.billingInterval
    || (parsed.data.planCode === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY')

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (isSubscriptionActive(subscription)) {
    return NextResponse.json({ error: 'Sua assinatura Pro já está ativa.' }, { status: 409 })
  }

  const pricing = getPublicPricing()
  const checkoutUrl = interval === 'ANNUAL' ? pricing.proAnnual.url : pricing.proMonthly.url
  if (!checkoutUrl) return NextResponse.json({ error: 'Checkout temporariamente indisponível.' }, { status: 503 })

  const suppliedKey = request.headers.get('idempotency-key')?.trim()
  if (suppliedKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(suppliedKey)) {
    return NextResponse.json({ error: 'Chave de idempotência inválida.' }, { status: 400 })
  }
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000))
  const idempotencySource = suppliedKey || `${user.id}:${interval}:${timeBucket}`
  const idempotencyHash = createHash('sha256').update(`${user.id}:${interval}:${idempotencySource}`).digest('hex')
  const eventKey = `checkout:${idempotencyHash}`

  const existing = await prisma.paymentEvent.findUnique({ where: { eventKey } })
  if (existing) return checkoutResponse(checkoutUrl, interval, eventKey, true)

  const recentAttempts = await prisma.paymentEvent.count({
    where: {
      userId: user.id,
      eventType: 'checkout/created',
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  })
  if (recentAttempts >= 5) {
    return NextResponse.json({ error: 'Muitas tentativas de checkout. Aguarde alguns minutos.' }, { status: 429 })
  }

  try {
    await prisma.paymentEvent.create({
      data: {
        eventKey,
        eventType: 'checkout/created',
        userId: user.id,
        status: 'PROCESSED',
        processedAt: new Date(),
        metadata: JSON.stringify({ interval }),
      },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    return checkoutResponse(checkoutUrl, interval, eventKey, true)
  }

  return checkoutResponse(checkoutUrl, interval, eventKey, false, 201)
}

function checkoutResponse(
  checkoutUrl: string,
  interval: BillingInterval,
  idempotencyKey: string,
  duplicate: boolean,
  status = 200,
) {
  // A Nuvemshop não possui createPreference/init_point. O backend libera
  // somente URLs previamente configuradas, nunca uma URL enviada pelo cliente.
  return NextResponse.json({
    checkoutUrl,
    interval,
    idempotencyKey,
    duplicate,
    statusUrl: '/api/billing/status',
    pendingUrl: '/dashboard/assinatura?payment=pending',
  }, { status, headers: { 'Cache-Control': 'no-store' } })
}
