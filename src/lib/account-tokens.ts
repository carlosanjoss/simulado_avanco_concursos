import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export type AccountTokenPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD'

export function hashAccountToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createAccountToken(userId: string, purpose: AccountTokenPurpose, lifetimeMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashAccountToken(token)
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({ data: { userId, purpose, tokenHash, expiresAt: new Date(Date.now() + lifetimeMs) } }),
  ])
  return token
}
