import 'server-only'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromCookie, verifyToken } from '@/lib/auth'

export async function getAuthenticatedUser(request: NextRequest) {
  return getAuthenticatedUserFromCookie(request.headers.get('cookie'))
}

export async function getAuthenticatedUserFromCookie(cookie: string | null | undefined) {
  const token = getTokenFromCookie(cookie)
  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true,
      isAdmin: true,
      accountStatus: true,
      tokenVersion: true,
      createdAt: true,
      lastLoginAt: true,
    },
  })

  if (!user || user.accountStatus !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) return null
  return user
}

export async function getAdminUser(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  return user?.isAdmin ? user : null
}
