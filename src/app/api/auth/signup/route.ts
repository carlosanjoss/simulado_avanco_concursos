import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth'
import { checkAuthRateLimit, getRequestIp } from '@/lib/auth-rate-limit'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createAccountToken } from '@/lib/account-tokens'
import { sendVerificationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

class SignupError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, token, bootstrapToken, termsAccepted } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }
    if (termsAccepted !== true) {
      return NextResponse.json({ error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade' }, { status: 400 })
    }
    if (String(password).length < 8 || String(password).length > 200) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }
    const allowed = await checkAuthRateLimit(`${getRequestIp(request)}:${normalizedEmail}`)
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429 })
    }
    const cleanName = (typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail.split('@')[0]).slice(0, 100)
    const configuredBootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN
    const canBootstrap = Boolean(configuredBootstrapToken && bootstrapToken === configuredBootstrapToken)
    const publicSignupEnabled = process.env.PUBLIC_SIGNUP_ENABLED === 'true' || process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true'
    const tokenHash = token ? createHash('sha256').update(String(token)).digest('hex') : null
    const passwordHash = await hashPassword(String(password))

    const user = await prisma.$transaction(async (tx) => {
      const invite = tokenHash ? await tx.pendingInvite.findUnique({ where: { token: tokenHash } }) : null
      if (tokenHash && (!invite || invite.used || invite.expiresAt < new Date())) {
        throw new SignupError('Convite inválido ou expirado')
      }
      if (invite && invite.email !== normalizedEmail) throw new SignupError('E-mail não confere com o convite')

      const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } })
      if (existingUser?.password) throw new SignupError('Usuário já cadastrado. Faça login.')

      let createdUser
      if (existingUser) {
        if (!invite) throw new SignupError('Convite obrigatório para este e-mail')
        createdUser = await tx.user.update({
          where: { id: existingUser.id },
          data: { name: cleanName, password: passwordHash, accountStatus: 'ACTIVE', emailVerifiedAt: invite ? new Date() : existingUser.emailVerifiedAt, termsAcceptedAt: new Date(), legalVersion: '2026-10-08', tokenVersion: { increment: 1 } },
        })
      } else {
        const userCount = await tx.user.count()
        const isAdmin = userCount === 0 && canBootstrap
        if (!invite && !isAdmin && !publicSignupEnabled) throw new SignupError('É necessário um convite para criar a conta')
        createdUser = await tx.user.create({
          data: { email: normalizedEmail, name: cleanName, password: passwordHash, isAdmin, emailVerifiedAt: invite || isAdmin ? new Date() : null, termsAcceptedAt: new Date(), legalVersion: '2026-10-08' },
        })
      }

      if (invite) {
        const consumed = await tx.pendingInvite.updateMany({
          where: { id: invite.id, used: false, expiresAt: { gt: new Date() } }, data: { used: true },
        })
        if (consumed.count !== 1) throw new SignupError('Convite já utilizado ou expirado')
      }
      return createdUser
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (!user.emailVerifiedAt) {
      const verificationToken = await createAccountToken(user.id, 'VERIFY_EMAIL', 24 * 60 * 60 * 1000)
      const delivery = await sendVerificationEmail({ to: user.email, token: verificationToken })
      return NextResponse.json({ verificationRequired: true, emailSent: delivery.sent })
    }

    const authToken = await createToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      tokenVersion: user.tokenVersion,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        isAdmin: user.isAdmin,
      },
    })
    response.headers.set('Set-Cookie', setAuthCookie(authToken))
    return response
  } catch (error) {
    if (error instanceof SignupError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Erro no cadastro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
