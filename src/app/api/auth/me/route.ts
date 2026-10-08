import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const { accountStatus: _status, tokenVersion: _version, ...publicUser } = user
    return NextResponse.json({ user: publicUser })
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return NextResponse.json({ user: null })
  }
}
