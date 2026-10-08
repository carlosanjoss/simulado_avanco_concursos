import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextSubscriptionPeriodEnd, normalizeNuvemshopOrder } from '@/lib/nuvemshop'

afterEach(() => vi.unstubAllEnvs())

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

  it('extends from the existing period instead of losing paid days', () => {
    const paidAt = new Date('2026-10-08T12:00:00Z')
    const currentEnd = new Date('2026-10-20T12:00:00Z')
    expect(nextSubscriptionPeriodEnd('MONTHLY', currentEnd, paidAt).toISOString()).toBe('2026-11-20T12:00:00.000Z')
  })
})
