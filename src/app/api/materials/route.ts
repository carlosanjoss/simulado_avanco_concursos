import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { listVectorMaterials } from '@/lib/document-vector-store'
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'
import { getUserPlanAccess } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!isSupabaseVectorConfigured()) return NextResponse.json({ materials: [] })
  try {
    const includeArchived = new URL(request.url).searchParams.get('archived') === 'true'
    const [materials, access] = await Promise.all([listVectorMaterials(user.id, includeArchived), getUserPlanAccess(user)])
    const simulations = await prisma.simuladoMaterial.findMany({ where: { simulado: { userId: user.id, deletedAt: null } }, select: { documentId: true } })
    const usage = new Map<string, number>()
    simulations.forEach((item) => usage.set(item.documentId, (usage.get(item.documentId) || 0) + 1))
    return NextResponse.json({ materials: materials.map((item) => ({ ...item, usageCount: usage.get(item.id) || 0 })), access: { planCode: access.planCode, materialLimit: access.materialLimit } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Material list failed:', message)
    if (/invalid api key/i.test(message)) {
      return NextResponse.json(
        { error: 'As chaves do Supabase não correspondem ao projeto configurado.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não foi possível carregar seus materiais.' }, { status: 500 })
  }
}
