import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'

const taskSchema = z.object({
  id: z.string().min(1).max(300), scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string().min(1).max(160), mode: z.string().min(1).max(80), duration: z.number().int().min(10).max(240),
})
const syncSchema = z.object({ action: z.literal('sync'), weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tasks: z.array(taskSchema).min(1).max(14) }).strict()
const progressSchema = z.object({ action: z.literal('progress').default('progress'), weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), taskKey: z.string().min(1).max(300), completed: z.boolean() }).strict()
const settingsSchema = z.object({
  action: z.literal('settings'), examName: z.string().trim().max(160).nullable(), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7), minutesPerDay: z.number().int().min(15).max(240),
  weeklyGoal: z.number().int().min(1).max(14), notificationsEnabled: z.boolean(),
}).strict()

async function authorized(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (!(await getUserPlanAccess(user)).studyPlan) return { error: NextResponse.json({ error: 'O plano Pro é necessário para usar o plano de estudos.' }, { status: 403 }) }
  return { user }
}

export async function POST(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const parsed = syncSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Plano semanal inválido' }, { status: 400 })
  await prisma.$transaction(parsed.data.tasks.map((task) => prisma.studyPlanProgress.upsert({
    where: { userId_weekKey_taskKey: { userId: auth.user.id, weekKey: parsed.data.weekKey, taskKey: task.id } },
    create: { userId: auth.user.id, weekKey: parsed.data.weekKey, taskKey: task.id, scheduledDate: new Date(`${task.scheduledDate}T12:00:00`), theme: task.theme, mode: task.mode, durationMinutes: task.duration },
    update: { scheduledDate: new Date(`${task.scheduledDate}T12:00:00`), theme: task.theme, mode: task.mode, durationMinutes: task.duration },
  })))
  return NextResponse.json({ success: true })
}

export async function PUT(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const body = await request.json().catch(() => null)
  const settings = settingsSchema.safeParse(body)
  if (settings.success) {
    const data = settings.data
    await prisma.studyPlanSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, examName: data.examName, examDate: data.examDate ? new Date(`${data.examDate}T12:00:00`) : null, availableDays: JSON.stringify([...new Set(data.availableDays)].sort()), minutesPerDay: data.minutesPerDay, weeklyGoal: data.weeklyGoal, notificationsEnabled: data.notificationsEnabled },
      update: { examName: data.examName, examDate: data.examDate ? new Date(`${data.examDate}T12:00:00`) : null, availableDays: JSON.stringify([...new Set(data.availableDays)].sort()), minutesPerDay: data.minutesPerDay, weeklyGoal: data.weeklyGoal, notificationsEnabled: data.notificationsEnabled },
    })
    return NextResponse.json({ success: true })
  }
  const parsed = progressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Progresso inválido' }, { status: 400 })
  const { weekKey, taskKey, completed } = parsed.data
  await prisma.studyPlanProgress.upsert({
    where: { userId_weekKey_taskKey: { userId: auth.user.id, weekKey, taskKey } },
    create: { userId: auth.user.id, weekKey, taskKey, completed, completedAt: completed ? new Date() : null },
    update: { completed, completedAt: completed ? new Date() : null },
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorized(request); if ('error' in auth) return auth.error
  const weekKey = new URL(request.url).searchParams.get('weekKey')
  if (!weekKey || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return NextResponse.json({ error: 'Semana inválida' }, { status: 400 })
  await prisma.studyPlanProgress.deleteMany({ where: { userId: auth.user.id, weekKey } })
  return NextResponse.json({ success: true })
}
