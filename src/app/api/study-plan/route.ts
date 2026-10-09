import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'

const progressSchema = z.object({ weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), taskKey: z.string().min(1).max(300), completed: z.boolean() }).strict()

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const parsed = progressSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Progresso inválido' }, { status: 400 })
  const { weekKey, taskKey, completed } = parsed.data
  await prisma.studyPlanProgress.upsert({
    where: { userId_weekKey_taskKey: { userId: user.id, weekKey, taskKey } },
    create: { userId: user.id, weekKey, taskKey, completed, completedAt: completed ? new Date() : null },
    update: { completed, completedAt: completed ? new Date() : null },
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const weekKey = new URL(request.url).searchParams.get('weekKey')
  if (!weekKey || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return NextResponse.json({ error: 'Semana inválida' }, { status: 400 })
  await prisma.studyPlanProgress.deleteMany({ where: { userId: user.id, weekKey } })
  return NextResponse.json({ success: true })
}
