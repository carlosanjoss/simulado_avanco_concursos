import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkAuthRateLimit, getRequestIp } from '@/lib/auth-rate-limit'
import { createAccountToken } from '@/lib/account-tokens'
import { sendPasswordResetEmail } from '@/lib/email'

const schema = z.object({ email: z.string().trim().email().max(254) })
const genericResponse = { success: true, message: 'Se a conta existir, enviaremos as instruções por e-mail.' }

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(genericResponse)
  const email = parsed.data.email.toLowerCase()
  if (!await checkAuthRateLimit(`forgot:${getRequestIp(request)}:${email}`)) {
    return NextResponse.json(genericResponse)
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, accountStatus: true } })
  if (!user || user.accountStatus !== 'ACTIVE') return NextResponse.json(genericResponse)

  const token = await createAccountToken(user.id, 'RESET_PASSWORD', 60 * 60 * 1000)
  const delivery = await sendPasswordResetEmail({ to: user.email, token })
  if (!delivery.sent) console.error('Falha ao enviar recuperação de senha:', delivery.error)
  return NextResponse.json(genericResponse)
}
