import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const { id } = await params
  const invite = await prisma.pendingInvite.findUnique({ where: { id }, select: { id: true, email: true } })
  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  await prisma.$transaction([
    prisma.pendingInvite.delete({ where: { id: invite.id } }),
    prisma.adminAuditLog.create({ data: { actorUserId: admin.id, action: 'INVITE_CANCELLED', metadata: JSON.stringify({ email: invite.email }) } }),
  ])
  return NextResponse.json({ success: true })
}
