import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'
import { buildInviteUrl, isEmailConfigured, sendInviteEmail } from '@/lib/email'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminUser = await getAdminUser(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado: apenas administradores' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name } = body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const recipientName = typeof name === 'string' && name.trim() ? name.trim() : undefined

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser && existingUser.password) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado' }, { status: 400 })
    }
    // Se existe mas sem senha (usuário legado), permite reenviar convite para ele definir a senha.

    // Verificar se já existe convite pendente
    const existingInvite = await prisma.pendingInvite.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingInvite && !existingInvite.used && existingInvite.expiresAt > new Date()) {
      return NextResponse.json({ error: 'Já existe um convite pendente para este e-mail' }, { status: 400 })
    }

    // Gerar token único
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

    // Criar convite
    await prisma.pendingInvite.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        token: inviteTokenHash,
        name: recipientName,
        expiresAt,
      },
      update: {
        token: inviteTokenHash,
        name: recipientName,
        expiresAt,
        used: false,
      },
    })

    // URL do convite
    const inviteUrl = buildInviteUrl(inviteToken)

    await prisma.adminAuditLog.create({
      data: {
        actorUserId: adminUser.id,
        targetUserId: existingUser?.id,
        action: 'USER_INVITED',
        metadata: JSON.stringify({ email: normalizedEmail }),
      },
    })

    // Enviar e-mail de convite (se configurado)
    const emailResult = await sendInviteEmail({
      to: normalizedEmail,
      inviteUrl,
      name: recipientName,
    })

    return NextResponse.json({
      success: true,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
      emailTransport: emailResult.transport,
      emailConfigured: isEmailConfigured(),
      message: emailResult.sent
        ? 'Convite enviado por e-mail'
        : isEmailConfigured()
          ? 'Convite criado, mas o e-mail não pôde ser enviado. Copie o link manualmente.'
          : 'Convite criado. E-mail não configurado — copie o link manualmente.',
      inviteUrl,
    })
  } catch (error) {
    console.error('Erro ao criar convite:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
