import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'
})

describe('custom authentication tokens', () => {
  it('preserves the session version used for revocation', async () => {
    const { createToken, verifyToken } = await import('@/lib/auth')
    const token = await createToken({ userId: 'user-1', email: 'user@example.com', isAdmin: true, tokenVersion: 4 })
    await expect(verifyToken(token)).resolves.toMatchObject({ userId: 'user-1', isAdmin: true, tokenVersion: 4 })
  })

  it('rejects malformed tokens', async () => {
    const { verifyToken } = await import('@/lib/auth')
    await expect(verifyToken('invalid-token')).resolves.toBeNull()
  })
})
