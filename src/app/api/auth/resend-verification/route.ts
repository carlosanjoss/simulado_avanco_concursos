import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkAuthRateLimit, getRequestIp } from '@/lib/auth-rate-limit'
import { createAccountToken } from '@/lib/account-tokens'
import { sendVerificationEmail } from '@/lib/email'

const schema = z.object({ email: z.string().trim().email().max(254) })
const genericResponse = { success: true, message: 'Se a conta precisar de confirmação, enviaremos um novo e-mail.' }

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(genericResponse)
  const email = parsed.data.email.toLowerCase()
  if (!await checkAuthRateLimit(`verify:${getRequestIp(request)}:${email}`)) return NextResponse.json(genericResponse)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerifiedAt: true, accountStatus: true } })
  if (!user || user.emailVerifiedAt || user.accountStatus !== 'ACTIVE') return NextResponse.json(genericResponse)
  const token = await createAccountToken(user.id, 'VERIFY_EMAIL', 24 * 60 * 60 * 1000)
  const delivery = await sendVerificationEmail({ to: user.email, token })
  if (!delivery.sent) console.error('Falha ao reenviar verificação:', delivery.error)
  return NextResponse.json(genericResponse)
}
