import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchNuvemshopOrder,
  getNuvemshopOrderDisposition,
  nextSubscriptionPeriodEnd,
  normalizeNuvemshopOrder,
  verifyNuvemshopWebhookSignature,
} from '@/lib/nuvemshop'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Nuvemshop billing integration', () => {
  it('matches a monthly Pro order by the documented SKU', () => {
    const order = normalizeNuvemshopOrder({
      id: 123,
      payment_status: 'paid',
      contact_email: 'Pessoa@Example.com ',
      customer: { id: 99 },
      subscription: { id: 'sub-1' },
      products: [{ product_id: 10, variant_id: 20, sku: 'AVANCO_PRO_MONTHLY' }],
    })
    expect(order).toMatchObject({ id: '123', email: 'pessoa@example.com', customerId: '99', subscriptionId: 'sub-1', plan: { planCode: 'PRO', billingInterval: 'MONTHLY' } })
  })

  it('matches an annual product configured by id', () => {
    vi.stubEnv('NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID', '500')
    const order = normalizeNuvemshopOrder({ id: '1', status: 'paid', customer: { email: 'a@b.com' }, products: [{ product_id: 500 }] })
    expect(order.plan?.billingInterval).toBe('ANNUAL')
  })

  it('matches the configured Nuvemshop product variants used by the checkouts', () => {
    vi.stubEnv('NUVEMSHOP_PRO_MONTHLY_VARIANT_ID', '1620509884')
    vi.stubEnv('NUVEMSHOP_PRO_ANNUAL_VARIANT_ID', '1620512017')

    const monthly = normalizeNuvemshopOrder({
      id: 'monthly-order',
      payment_status: 'paid',
      products: [{ product_id: 374674435, variant_id: 1620509884 }],
    })
    const annual = normalizeNuvemshopOrder({
      id: 'annual-order',
      payment_status: 'paid',
      products: [{ product_id: 374675033, variant_id: 1620512017 }],
    })

    expect(monthly.plan?.billingInterval).toBe('MONTHLY')
    expect(annual.plan?.billingInterval).toBe('ANNUAL')
  })

  it('extends from the existing period instead of losing paid days', () => {
    const paidAt = new Date('2026-10-08T12:00:00Z')
    const currentEnd = new Date('2026-10-20T12:00:00Z')
    expect(nextSubscriptionPeriodEnd('MONTHLY', currentEnd, paidAt).toISOString()).toBe('2026-11-20T12:00:00.000Z')
  })

  it('fetches orders from the Brazilian Nuvemshop API endpoint', async () => {
    vi.stubEnv('NUVEMSHOP_STORE_ID', '4377151')
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'suporte@example.com')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 99,
      payment_status: 'paid',
      products: [],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchNuvemshopOrder('99')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nuvemshop.com.br/v1/4377151/orders/99',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'User-Agent': 'Avanco Simulados (suporte@example.com)',
        }),
      }),
    )
  })

  it('validates the official HMAC against the untouched raw body', () => {
    vi.stubEnv('NUVEMSHOP_APP_SECRET', 'app-secret-for-test')
    const body = JSON.stringify({ store_id: 4377151, event: 'order/paid', id: 99 })
    const signature = createHmac('sha256', 'app-secret-for-test').update(body, 'utf8').digest('hex')

    expect(verifyNuvemshopWebhookSignature(body, signature)).toBe(true)
    expect(verifyNuvemshopWebhookSignature(`${body} `, signature)).toBe(false)
    expect(verifyNuvemshopWebhookSignature(body, 'invalid')).toBe(false)
  })

  it('classifies paid, cancelled and refunded orders without trusting the webhook event', () => {
    expect(getNuvemshopOrderDisposition({ orderStatus: 'open', paymentStatus: 'paid' })).toBe('ACTIVE')
    expect(getNuvemshopOrderDisposition({ orderStatus: 'cancelled', paymentStatus: 'paid' })).toBe('CANCELED')
    expect(getNuvemshopOrderDisposition({ orderStatus: 'closed', paymentStatus: 'refunded' })).toBe('REVOKED')
    expect(getNuvemshopOrderDisposition({ orderStatus: 'open', paymentStatus: 'pending' })).toBe('PENDING')
  })
})
