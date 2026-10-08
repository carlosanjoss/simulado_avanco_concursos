import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth'
import { checkAuthRateLimit, getRequestIp } from '@/lib/auth-rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const allowed = await checkAuthRateLimit(`${getRequestIp(request)}:${normalizedEmail}`)
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user || !user.password || user.accountStatus !== 'ACTIVE') {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    if (!user.emailVerifiedAt) {
      return NextResponse.json({ error: 'Confirme seu e-mail antes de entrar', code: 'EMAIL_NOT_VERIFIED' }, { status: 403 })
    }

    const loggedInUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await createToken({
      userId: loggedInUser.id,
      email: loggedInUser.email,
      isAdmin: loggedInUser.isAdmin,
      tokenVersion: loggedInUser.tokenVersion,
    })

    const response = NextResponse.json({
      user: {
        id: loggedInUser.id,
        email: loggedInUser.email,
        name: loggedInUser.name,
        imageUrl: loggedInUser.imageUrl,
        isAdmin: loggedInUser.isAdmin,
      },
    })
    response.headers.set('Set-Cookie', setAuthCookie(token))
    return response
  } catch (error) {
    console.error('Erro no login:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
