import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { hashPassword, verifyPassword } from '@/lib/auth'

const profileSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update-name'), name: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal('change-password'), currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) }),
])

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const parsed = profileSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  if (parsed.data.action === 'update-name') {
    await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } })
    return NextResponse.json({ success: true, sessionRevoked: false })
  }

  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
  if (!stored?.password || !await verifyPassword(parsed.data.currentPassword, stored.password)) {
    return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
  }
  const password = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { password, tokenVersion: { increment: 1 } } })
  return NextResponse.json({ success: true, sessionRevoked: true })
}
