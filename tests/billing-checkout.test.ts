import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  findSubscription: vi.fn(),
  findEvent: vi.fn(),
  countEvents: vi.fn(),
  createEvent: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findUnique: mocks.findSubscription },
    paymentEvent: {
      findUnique: mocks.findEvent,
      count: mocks.countEvents,
      create: mocks.createEvent,
    },
  },
}))
vi.mock('@/lib/plans', () => ({
  getPublicPricing: () => ({
    proMonthly: { label: '29,90', url: 'https://www.avancoconcursos.com.br/produtos/mensal/' },
    proAnnual: { label: '299,90', url: 'https://www.avancoconcursos.com.br/produtos/anual/' },
  }),
  isSubscriptionActive: (subscription: { status?: string } | null) => subscription?.status === 'ACTIVE',
}))

import { POST } from '@/app/api/billing/checkout/route'

function request(interval = 'MONTHLY', key = 'checkout-key-123') {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ billingInterval: interval }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mocks.findSubscription.mockResolvedValue(null)
  mocks.findEvent.mockResolvedValue(null)
  mocks.countEvents.mockResolvedValue(0)
  mocks.createEvent.mockResolvedValue({ id: 'event-1' })
})

describe('billing checkout endpoint', () => {
  it('returns only the server-configured monthly checkout and records the attempt', async () => {
    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.checkoutUrl).toBe('https://www.avancoconcursos.com.br/produtos/mensal/')
    expect(mocks.createEvent).toHaveBeenCalledOnce()
  })

  it('returns the same checkout for a repeated idempotency key', async () => {
    mocks.findEvent.mockResolvedValue({ id: 'existing-event' })
    const response = await POST(request('ANNUAL'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.checkoutUrl).toBe('https://www.avancoconcursos.com.br/produtos/anual/')
    expect(payload.duplicate).toBe(true)
    expect(mocks.createEvent).not.toHaveBeenCalled()
  })

  it('blocks checkout when Pro is already active', async () => {
    mocks.findSubscription.mockResolvedValue({ status: 'ACTIVE' })
    const response = await POST(request())
    expect(response.status).toBe(409)
  })

  it('requires an authenticated user', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null)
    const response = await POST(request())
    expect(response.status).toBe(401)
  })
})
