import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { deleteVectorDocument, getVectorDocument, updateVectorMaterial } from '@/lib/document-vector-store'

const updateSchema = z.object({ fileName: z.string().trim().min(1).max(255).optional(), archived: z.boolean().optional() }).strict().refine((value) => value.fileName !== undefined || value.archived !== undefined)
type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: 'Alteração inválida' }, { status: 400 })
  const document = await getVectorDocument(id, user.id)
  if (!document) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  await updateVectorMaterial(id, user.id, parsed.data)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Material inválido' }, { status: 400 })
  const document = await getVectorDocument(id, user.id)
  if (!document) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  await deleteVectorDocument(id, user.id)
  return NextResponse.json({ success: true })
}
