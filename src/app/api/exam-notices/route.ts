import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import { parseSyllabusText, topicMatchesText, type ParsedSyllabus } from '@/lib/syllabus'
import type { Question } from '@/types/quiz'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sourceFileName: z.string().trim().max(255).nullable().optional(),
  text: z.string().trim().min(30).max(500_000),
}).strict()

const updateSchema = z.object({ id: z.string().min(1).max(120), active: z.boolean().optional(), remove: z.boolean().optional() }).strict()

async function authorize(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (!(await getUserPlanAccess(user)).examNotice) return { error: NextResponse.json({ error: 'O leitor de edital é exclusivo do plano Pro.' }, { status: 403 }) }
  return { user }
}

function readSyllabus(value: string): ParsedSyllabus {
  try { return JSON.parse(value) as ParsedSyllabus } catch { return { sections: [], warnings: ['Não foi possível ler a estrutura salva.'] } }
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request); if ('error' in auth) return auth.error
  const [notices, simulados, attempts] = await Promise.all([
    prisma.examNotice.findMany({ where: { userId: auth.user.id }, orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] }),
    prisma.simulado.findMany({ where: { userId: auth.user.id, deletedAt: null }, select: { id: true, questoesJson: true, pdfNome: true, materials: { select: { fileName: true } } } }),
    prisma.tentativa.findMany({ where: { userId: auth.user.id, concluidoEm: { not: null } }, select: { simuladoId: true, respostas: true } }),
  ])
  const attemptsByQuiz = new Map(attempts.map((attempt) => [attempt.simuladoId, JSON.parse(attempt.respostas || '{}') as Record<string, string>]))
  const questionRows = simulados.flatMap((simulado) => {
    let questions: Question[] = []
    try { questions = JSON.parse(simulado.questoesJson) as Question[] } catch { /* malformed legacy quiz */ }
    const answers = attemptsByQuiz.get(simulado.id) || {}
    const materials = Array.from(new Set([simulado.pdfNome, ...simulado.materials.map((item) => item.fileName)].filter(Boolean)))
    return questions.map((question) => ({ question, answer: answers[String(question.id)], materials }))
  })

  return NextResponse.json({ notices: notices.map((notice) => {
    const syllabus = readSyllabus(notice.syllabusJson)
    const sections = syllabus.sections.map((section, sectionIndex) => ({ ...section, id: `${section.id}-${sectionIndex + 1}`, topics: section.topics.map((topic, topicIndex) => {
      const matches = questionRows.filter((row) => topicMatchesText(topic.title, `${row.question.tema} ${row.question.enunciado}`))
      const evaluated = matches.map((row) => row.answer ? evaluateAnswer(row.question, row.answer).correct : null).filter((value) => value !== null)
      const correct = evaluated.filter(Boolean).length
      const accuracy = evaluated.length ? Math.round((correct / evaluated.length) * 100) : null
      const materials = Array.from(new Set(matches.flatMap((row) => row.materials))).slice(0, 8)
      return { ...topic, id: `${topic.id}-${sectionIndex + 1}-${topicIndex + 1}`, questionCount: matches.length, answeredCount: evaluated.length, accuracy, studied: matches.length > 0, materials }
    }) }))
    const topics = sections.flatMap((section) => section.topics)
    return {
      id: notice.id, title: notice.title, examDate: notice.examDate?.toISOString().slice(0, 10) || null,
      sourceFileName: notice.sourceFileName, active: notice.active, createdAt: notice.createdAt.toISOString(),
      sections, warnings: syllabus.warnings, progress: topics.length ? Math.round((topics.filter((topic) => topic.studied).length / topics.length) * 100) : 0,
      missingMaterials: topics.filter((topic) => topic.materials.length === 0).length,
    }
  }) })
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request); if ('error' in auth) return auth.error
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados do edital inválidos.' }, { status: 400 })
  const syllabus = parseSyllabusText(parsed.data.text)
  const topicCount = syllabus.sections.reduce((sum, section) => sum + section.topics.length, 0)
  if (!topicCount) return NextResponse.json({ error: 'Nenhum tópico foi identificado. Revise o PDF ou cole o conteúdo programático.' }, { status: 422 })
  const created = await prisma.$transaction(async (tx) => {
    await tx.examNotice.updateMany({ where: { userId: auth.user.id, active: true }, data: { active: false } })
    const notice = await tx.examNotice.create({ data: {
      userId: auth.user.id, title: parsed.data.title, examDate: parsed.data.examDate ? new Date(`${parsed.data.examDate}T12:00:00`) : null,
      sourceFileName: parsed.data.sourceFileName || null, syllabusJson: JSON.stringify(syllabus), active: true,
    } })
    await tx.studyPlanSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, examName: parsed.data.title, examDate: parsed.data.examDate ? new Date(`${parsed.data.examDate}T12:00:00`) : null },
      update: { examName: parsed.data.title, examDate: parsed.data.examDate ? new Date(`${parsed.data.examDate}T12:00:00`) : null },
    })
    return notice
  })
  return NextResponse.json({ success: true, id: created.id, topicCount, warnings: syllabus.warnings })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize(request); if ('error' in auth) return auth.error
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Alteração inválida.' }, { status: 400 })
  const owned = await prisma.examNotice.findFirst({ where: { id: parsed.data.id, userId: auth.user.id } })
  if (!owned) return NextResponse.json({ error: 'Edital não encontrado.' }, { status: 404 })
  if (parsed.data.remove) {
    await prisma.examNotice.delete({ where: { id: owned.id } })
    return NextResponse.json({ success: true })
  }
  if (parsed.data.active) {
    await prisma.$transaction([
      prisma.examNotice.updateMany({ where: { userId: auth.user.id }, data: { active: false } }),
      prisma.examNotice.update({ where: { id: owned.id }, data: { active: true } }),
    ])
  }
  return NextResponse.json({ success: true })
}
