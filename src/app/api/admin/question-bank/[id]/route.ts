import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/server-auth'
import { hasLicensedOfficialSource } from '@/lib/question-bank'

const schema = z.object({
  status: z.enum(['CURATED', 'REJECTED']),
  sourceType: z.enum(['USER_GENERATED', 'OFFICIAL_LICENSED']).default('USER_GENERATED'),
  sourceName: z.string().trim().max(300).nullable().optional(),
  licenseReference: z.string().trim().max(1000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (!hasLicensedOfficialSource(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Questões oficiais exigem fonte e referência de licença.' })
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser(request)
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
  const { id } = await params
  const current = await prisma.questionBankEntry.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
  const updated = await prisma.$transaction(async (transaction) => {
    const entry = await transaction.questionBankEntry.update({ where: { id }, data: { editorialStatus: parsed.data.status, sourceType: parsed.data.sourceType, sourceName: parsed.data.sourceName, licenseReference: parsed.data.licenseReference } })
    await transaction.auditLog.create({ data: { userId: admin.id, action: 'CURATE_QUESTION', status: 'SUCCESS', metadata: JSON.stringify({ entryId: id, ownerId: current.userId, editorialStatus: parsed.data.status, sourceType: parsed.data.sourceType }) } })
    return entry
  })
  return NextResponse.json({ success: true, entry: updated })
}
