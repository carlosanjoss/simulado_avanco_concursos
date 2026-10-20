import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { addMonths, addYears } from 'date-fns'
import type { BillingInterval } from '@/lib/plans'

type UnknownRecord = Record<string, unknown>

export interface NuvemshopPlanMatch {
  planCode: 'PRO'
  billingInterval: BillingInterval
  productId: string
}

export interface NuvemshopOrderSummary {
  id: string
  email: string | null
  orderStatus: string | null
  paymentStatus: string | null
  customerId: string | null
  subscriptionId: string | null
  plan: NuvemshopPlanMatch | null
  raw: UnknownRecord
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function safeSecretEqual(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function verifyNuvemshopWebhook(request: Request, storeId: string | number): boolean {
  const expectedStoreId = process.env.NUVEMSHOP_STORE_ID
  if (!expectedStoreId || String(storeId) !== expectedStoreId) return false
  return safeSecretEqual(request.headers.get('x-avanco-webhook-secret'), process.env.NUVEMSHOP_WEBHOOK_SECRET)
}

export function verifyNuvemshopWebhookSignature(rawBody: string, hmacHeader: string | null): boolean {
  const appSecret = process.env.NUVEMSHOP_APP_SECRET
  if (!appSecret || !hmacHeader) return false
  const receivedHex = hmacHeader.trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(receivedHex)) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  const received = Buffer.from(receivedHex, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export function verifySecureNuvemshopWebhook(request: Request, storeId: string | number, rawBody: string): boolean {
  const expectedStoreId = process.env.NUVEMSHOP_STORE_ID
  if (!expectedStoreId || String(storeId) !== expectedStoreId) return false
  if (process.env.NUVEMSHOP_APP_SECRET) {
    return verifyNuvemshopWebhookSignature(rawBody, request.headers.get('x-linkedstore-hmac-sha256'))
  }
  // O cabeçalho personalizado existe apenas para desenvolvimento/migração.
  // Produção exige o HMAC oficial calculado com o segredo da aplicação.
  if (process.env.NODE_ENV === 'production') return false
  return verifyNuvemshopWebhook(request, storeId)
}

export function isNuvemshopConfigured(): boolean {
  return Boolean(
    process.env.NUVEMSHOP_STORE_ID
    && process.env.NUVEMSHOP_ACCESS_TOKEN
    && (process.env.NODE_ENV !== 'production' || process.env.NUVEMSHOP_APP_SECRET)
    && process.env.NUVEMSHOP_WEBHOOK_SECRET
    && (
      process.env.NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID
      || process.env.NUVEMSHOP_PRO_MONTHLY_VARIANT_ID
      || process.env.NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID
      || process.env.NUVEMSHOP_PRO_ANNUAL_VARIANT_ID
    ),
  )
}

function getPlanFromProducts(products: unknown): NuvemshopPlanMatch | null {
  if (!Array.isArray(products)) return null
  const monthlyIds = new Set([
    process.env.NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID,
    process.env.NUVEMSHOP_PRO_MONTHLY_VARIANT_ID,
  ].filter((id): id is string => Boolean(id)))
  const annualIds = new Set([
    process.env.NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID,
    process.env.NUVEMSHOP_PRO_ANNUAL_VARIANT_ID,
  ].filter((id): id is string => Boolean(id)))

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const productId = asString(product.product_id ?? product.id)
    const variantId = asString(product.variant_id)
    const sku = asString(product.sku)?.toUpperCase()
    const ids = [productId, variantId].filter((id): id is string => Boolean(id))
    if (ids.some((id) => monthlyIds.has(id)) || sku === 'AVANCO_PRO_MONTHLY') {
      return { planCode: 'PRO', billingInterval: 'MONTHLY', productId: productId || variantId || sku! }
    }
    if (ids.some((id) => annualIds.has(id)) || sku === 'AVANCO_PRO_ANNUAL') {
      return { planCode: 'PRO', billingInterval: 'ANNUAL', productId: productId || variantId || sku! }
    }
  }
  return null
}

export function normalizeNuvemshopOrder(raw: unknown): NuvemshopOrderSummary {
  const order = asRecord(raw)
  if (!order) throw new Error('NUVEMSHOP_INVALID_ORDER')
  const customer = asRecord(order.customer)
  const subscription = asRecord(order.subscription)
  const email = asString(order.contact_email ?? customer?.email)?.toLowerCase() || null
  return {
    id: asString(order.id) || '',
    email,
    orderStatus: asString(order.status),
    paymentStatus: asString(order.payment_status ?? order.status),
    customerId: asString(customer?.id),
    subscriptionId: asString(order.subscription_id ?? subscription?.id),
    plan: getPlanFromProducts(order.products),
    raw: order,
  }
}

export function getNuvemshopOrderDisposition(order: Pick<NuvemshopOrderSummary, 'orderStatus' | 'paymentStatus'>): 'ACTIVE' | 'CANCELED' | 'REVOKED' | 'PENDING' {
  const orderStatus = order.orderStatus?.toLowerCase()
  const paymentStatus = order.paymentStatus?.toLowerCase()
  if (paymentStatus === 'refunded' || paymentStatus === 'voided') return 'REVOKED'
  if (orderStatus === 'cancelled') return 'CANCELED'
  if (paymentStatus === 'paid') return 'ACTIVE'
  return 'PENDING'
}

export async function fetchNuvemshopOrder(orderId: string | number): Promise<NuvemshopOrderSummary> {
  const storeId = process.env.NUVEMSHOP_STORE_ID
  const token = process.env.NUVEMSHOP_ACCESS_TOKEN
  if (!storeId || !token) throw new Error('NUVEMSHOP_NOT_CONFIGURED')
  const apiBaseUrl = (process.env.NUVEMSHOP_API_BASE_URL || 'https://api.nuvemshop.com.br/v1').replace(/\/$/, '')
  const identity = process.env.NUVEMSHOP_APP_ID || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'integracao-propria'
  const userAgent = process.env.NUVEMSHOP_USER_AGENT || `Avanco Simulados (${identity})`

  const response = await fetch(`${apiBaseUrl}/${storeId}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`NUVEMSHOP_ORDER_${response.status}`)
  return normalizeNuvemshopOrder(await response.json())
}

export function nextSubscriptionPeriodEnd(interval: BillingInterval, currentEnd: Date | null, paidAt = new Date()): Date {
  const base = currentEnd && currentEnd > paidAt ? currentEnd : paidAt
  return interval === 'ANNUAL' ? addYears(base, 1) : addMonths(base, 1)
}
