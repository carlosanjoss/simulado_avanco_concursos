import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'
import { getCurrentMonthKey } from '@/lib/usage-limit'
import { getSupabaseAdmin, isSupabaseVectorConfigured } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set-status'), status: z.enum(['ACTIVE', 'SUSPENDED']) }),
  z.object({ action: z.literal('set-role'), isAdmin: z.boolean() }),
  z.object({ action: z.literal('reset-usage') }),
  z.object({ action: z.literal('revoke-sessions') }),
])

async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { isAdmin: true, accountStatus: 'ACTIVE' } })
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, accountStatus: true } })
  return Boolean(target?.isAdmin && target.accountStatus === 'ACTIVE' && count <= 1)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const data = parsed.data
  if (data.action === 'set-status') {
    if (target.id === admin.id && data.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Você não pode suspender sua própria conta' }, { status: 409 })
    }
    if (data.status !== 'ACTIVE' && await isLastActiveAdmin(target.id)) {
      return NextResponse.json({ error: 'O último administrador ativo não pode ser suspenso' }, { status: 409 })
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { accountStatus: data.status, tokenVersion: { increment: 1 } } }),
      prisma.adminAuditLog.create({ data: { actorUserId: admin.id, targetUserId: target.id, action: 'USER_STATUS_CHANGED', metadata: JSON.stringify({ status: data.status, email: target.email }) } }),
    ])
  } else if (data.action === 'set-role') {
    if (target.id === admin.id && !data.isAdmin) {
      return NextResponse.json({ error: 'Você não pode remover seu próprio acesso administrativo' }, { status: 409 })
    }
    if (!data.isAdmin && await isLastActiveAdmin(target.id)) {
      return NextResponse.json({ error: 'O último administrador não pode ser rebaixado' }, { status: 409 })
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { isAdmin: data.isAdmin, tokenVersion: { increment: 1 } } }),
      prisma.adminAuditLog.create({ data: { actorUserId: admin.id, targetUserId: target.id, action: 'USER_ROLE_CHANGED', metadata: JSON.stringify({ isAdmin: data.isAdmin, email: target.email }) } }),
    ])
  } else if (data.action === 'reset-usage') {
    await prisma.$transaction([
      prisma.monthlyUsage.deleteMany({ where: { userId: target.id, monthKey: getCurrentMonthKey() } }),
      prisma.adminAuditLog.create({ data: { actorUserId: admin.id, targetUserId: target.id, action: 'USER_USAGE_RESET', metadata: JSON.stringify({ email: target.email }) } }),
    ])
  } else {
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.adminAuditLog.create({ data: { actorUserId: admin.id, targetUserId: target.id, action: 'USER_SESSIONS_REVOKED', metadata: JSON.stringify({ email: target.email }) } }),
    ])
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const { id } = await params
  if (id === admin.id) return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 409 })

  const body = await request.json().catch(() => null) as { confirmEmail?: string } | null
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true } })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  if (body?.confirmEmail?.trim().toLowerCase() !== target.email.toLowerCase()) {
    return NextResponse.json({ error: 'Digite o e-mail exato do usuário para confirmar' }, { status: 400 })
  }
  if (await isLastActiveAdmin(target.id)) {
    return NextResponse.json({ error: 'O último administrador ativo não pode ser excluído' }, { status: 409 })
  }

  let vectorCleanupWarning: string | undefined
  if (isSupabaseVectorConfigured()) {
    try {
      const supabase = await getSupabaseAdmin()
      const { error } = await supabase.from('simulado_documents').delete().eq('user_id', target.id)
      if (error) throw error
    } catch (error) {
      vectorCleanupWarning = error instanceof Error ? error.message : 'Falha ao remover dados vetoriais'
    }
  }

  await prisma.$transaction([
    prisma.pendingInvite.deleteMany({ where: { email: target.email } }),
    prisma.user.delete({ where: { id: target.id } }),
    prisma.adminAuditLog.create({ data: { actorUserId: admin.id, targetUserId: target.id, action: 'USER_DELETED', metadata: JSON.stringify({ email: target.email, vectorCleanupWarning }) } }),
  ])

  return NextResponse.json({ success: true, warning: vectorCleanupWarning })
}
