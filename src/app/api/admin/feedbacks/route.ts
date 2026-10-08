import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request)
    if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const feedbacks = await prisma.questionFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
        simulado: { select: { id: true, titulo: true, pdfNome: true } },
      },
    })
    return NextResponse.json({ feedbacks })
  } catch (error) {
    console.error('Error in admin feedbacks:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
