import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashAccountToken } from '@/lib/account-tokens'
import { hashPassword } from '@/lib/auth'

const schema = z.object({ token: z.string().min(20).max(500), password: z.string().min(8).max(200) })

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const tokenHash = hashAccountToken(parsed.data.token)
  const token = await prisma.authToken.findUnique({ where: { tokenHash } })
  if (!token || token.purpose !== 'RESET_PASSWORD' || token.usedAt || token.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  }
  const password = await hashPassword(parsed.data.password)
  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.authToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })
      if (consumed.count !== 1) throw new Error('TOKEN_ALREADY_USED')
      await tx.user.update({ where: { id: token.userId }, data: { password, emailVerifiedAt: new Date(), tokenVersion: { increment: 1 } } })
      await tx.authToken.deleteMany({ where: { userId: token.userId, purpose: 'RESET_PASSWORD', usedAt: null } })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') {
      return NextResponse.json({ error: 'Este link já foi utilizado. Solicite uma nova recuperação de senha.' }, { status: 409 })
    }
    throw error
  }
  return NextResponse.json({ success: true })
}
