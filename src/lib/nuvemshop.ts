import 'server-only'
import { timingSafeEqual } from 'node:crypto'
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

export function isNuvemshopConfigured(): boolean {
  return Boolean(process.env.NUVEMSHOP_STORE_ID && process.env.NUVEMSHOP_ACCESS_TOKEN && process.env.NUVEMSHOP_APP_ID)
}

function getPlanFromProducts(products: unknown): NuvemshopPlanMatch | null {
  if (!Array.isArray(products)) return null
  const monthlyId = process.env.NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID
  const annualId = process.env.NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const productId = asString(product.product_id ?? product.id)
    const variantId = asString(product.variant_id)
    const sku = asString(product.sku)?.toUpperCase()
    const ids = [productId, variantId].filter(Boolean)
    if ((monthlyId && ids.includes(monthlyId)) || sku === 'AVANCO_PRO_MONTHLY') {
      return { planCode: 'PRO', billingInterval: 'MONTHLY', productId: productId || variantId || sku! }
    }
    if ((annualId && ids.includes(annualId)) || sku === 'AVANCO_PRO_ANNUAL') {
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
    paymentStatus: asString(order.payment_status ?? order.status),
    customerId: asString(customer?.id),
    subscriptionId: asString(order.subscription_id ?? subscription?.id),
    plan: getPlanFromProducts(order.products),
    raw: order,
  }
}

export async function fetchNuvemshopOrder(orderId: string | number): Promise<NuvemshopOrderSummary> {
  const storeId = process.env.NUVEMSHOP_STORE_ID
  const token = process.env.NUVEMSHOP_ACCESS_TOKEN
  const appId = process.env.NUVEMSHOP_APP_ID
  if (!storeId || !token || !appId) throw new Error('NUVEMSHOP_NOT_CONFIGURED')

  const response = await fetch(`https://api.nuvemshop.com/v1/${storeId}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `Avanco Simulados (${appId})`,
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
