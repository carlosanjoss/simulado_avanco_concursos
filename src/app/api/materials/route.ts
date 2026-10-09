import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { listVectorMaterials } from '@/lib/document-vector-store'
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!isSupabaseVectorConfigured()) return NextResponse.json({ materials: [] })
  try {
    const includeArchived = new URL(request.url).searchParams.get('archived') === 'true'
    const materials = await listVectorMaterials(user.id, includeArchived)
    const simulations = await prisma.simulado.findMany({ where: { userId: user.id, sourceDocumentId: { not: null }, deletedAt: null }, select: { sourceDocumentId: true } })
    const usage = new Map<string, number>()
    simulations.forEach((item) => item.sourceDocumentId && usage.set(item.sourceDocumentId, (usage.get(item.sourceDocumentId) || 0) + 1))
    return NextResponse.json({ materials: materials.map((item) => ({ ...item, usageCount: usage.get(item.id) || 0 })) })
  } catch (error) {
    console.error('Material list failed:', error instanceof Error ? error.message : 'Erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível carregar seus materiais.' }, { status: 500 })
  }
}
