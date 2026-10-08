import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'
import { getCurrentMonthKey } from '@/lib/usage-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const query = (params.get('q') || '').trim().slice(0, 100)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = 20
  const where = query
    ? { OR: [
        { email: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
      ] }
    : {}
  const monthKey = getCurrentMonthKey()

  const [users, total, invites] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        accountStatus: true,
        createdAt: true,
        lastLoginAt: true,
        monthlyUsage: { where: { monthKey }, select: { count: true }, take: 1 },
        _count: { select: { simulados: true, tentativas: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.pendingInvite.findMany({
      where: { used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, email: true, name: true, expiresAt: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    users: users.map(({ monthlyUsage, ...user }) => ({ ...user, monthlyUsage: monthlyUsage[0]?.count ?? 0 })),
    invites,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  })
}
