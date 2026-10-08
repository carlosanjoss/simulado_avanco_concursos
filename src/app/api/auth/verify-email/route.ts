import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashAccountToken } from '@/lib/account-tokens'

const schema = z.object({ token: z.string().min(20).max(500) })

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
  const tokenHash = hashAccountToken(parsed.data.token)
  const token = await prisma.authToken.findUnique({ where: { tokenHash } })
  if (!token || token.purpose !== 'VERIFY_EMAIL' || token.usedAt || token.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  }
  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.authToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })
      if (consumed.count !== 1) throw new Error('TOKEN_ALREADY_USED')
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') {
      return NextResponse.json({ error: 'Link já utilizado' }, { status: 409 })
    }
    throw error
  }
  return NextResponse.json({ success: true })
}
