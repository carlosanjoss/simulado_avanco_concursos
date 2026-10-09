import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateAnswer } from '@/lib/quiz-evaluation'
import { attemptSubmissionSchema } from '@/lib/validations/attempt'
import type { Question } from '@/types/quiz'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { syncReviewCardsFromAttempt } from '@/lib/review-cards'

export const dynamic = 'force-dynamic'

function parseAnswers(value: string | null): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    // Skip auth during build time
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ success: true, tentativaId: 'build', isFinal: false })
    }

    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const parsed = attemptSubmissionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dados da tentativa inválidos' }, { status: 400 })
    const body = parsed.data

    const simulado = await prisma.simulado.findFirst({
      where: { id: body.simuladoId, userId: user.id, deletedAt: null },
      select: { id: true, questoesJson: true },
    })
    if (!simulado) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 })
    const questions = JSON.parse(simulado.questoesJson) as Question[]

    const activeKey = `${user.id}:${simulado.id}`
    const existing = await prisma.tentativa.findUnique({ where: { activeKey } })
    const storedAnswers = parseAnswers(existing?.respostas ?? null)
    const storedSelected = parseAnswers(existing?.selectedAnswers ?? null)
    const respostas = { ...storedAnswers, ...body.respostas }
    const selectedAnswers = { ...storedSelected, ...body.selectedAnswers, ...respostas }

    if (body.isFinal) {
      if (Object.keys(respostas).length !== questions.length) {
        return NextResponse.json({ error: 'Responda todas as questões antes de finalizar.' }, { status: 409 })
      }
      const objectiveQuestions = questions.filter((question) => question.tipo !== 'discursiva')
      const pontuacao = objectiveQuestions.filter(
        (question) => evaluateAnswer(question, respostas[question.id]).correct,
      ).length
      const percentual = objectiveQuestions.length ? (pontuacao / objectiveQuestions.length) * 100 : 0
      const now = new Date()
      const durationSeconds = Math.max(1, body.elapsedSeconds ?? existing?.durationSeconds ?? 0)

      const tentativa = existing
        ? await prisma.tentativa.update({
            where: { id: existing.id },
            data: {
              activeKey: null,
              respostas: JSON.stringify(respostas),
              selectedAnswers: JSON.stringify(selectedAnswers),
              pontuacao,
              totalQuestoes: questions.length,
              percentual,
              currentIndex: questions.length - 1,
              concluidoEm: now,
              durationSeconds,
            },
          })
        : await prisma.tentativa.create({
            data: {
              simuladoId: simulado.id,
              userId: user.id,
              respostas: JSON.stringify(respostas),
              selectedAnswers: JSON.stringify(selectedAnswers),
              pontuacao,
              totalQuestoes: questions.length,
              percentual,
              currentIndex: questions.length - 1,
              concluidoEm: now,
              durationSeconds,
            },
          })

      await prisma.simulado.update({ where: { id: simulado.id }, data: { status: 'CONCLUIDO' } })
      await syncReviewCardsFromAttempt({ userId: user.id, simuladoId: simulado.id, questions, answers: respostas })
        .catch((error) => console.error('Falha ao sincronizar caderno de erros:', error))
      return NextResponse.json({ success: true, tentativaId: tentativa.id, pontuacao, percentual, durationSeconds, isFinal: true })
    }

    const tentativa = await prisma.tentativa.upsert({
      where: { activeKey },
      create: {
        activeKey,
        simuladoId: simulado.id,
        userId: user.id,
        respostas: JSON.stringify(respostas),
        selectedAnswers: JSON.stringify(selectedAnswers),
        pontuacao: 0,
        totalQuestoes: questions.length,
        percentual: 0,
        currentIndex: body.currentIndex ?? 0,
        durationSeconds: body.elapsedSeconds ?? 0,
      },
      update: {
        respostas: JSON.stringify(respostas),
        selectedAnswers: JSON.stringify(selectedAnswers),
        currentIndex: body.currentIndex ?? existing?.currentIndex ?? 0,
        durationSeconds: body.elapsedSeconds ?? existing?.durationSeconds ?? 0,
      },
    })
    await prisma.simulado.update({ where: { id: simulado.id }, data: { status: 'EM_ANDAMENTO' } })
    return NextResponse.json({ success: true, tentativaId: tentativa.id, isFinal: false })
  } catch (error) {
    console.error('Error saving attempt:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Skip auth during build time
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ progress: null })
    }

    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const simuladoId = new URL(request.url).searchParams.get('simuladoId')
    if (!simuladoId) return NextResponse.json({ error: 'simuladoId obrigatório' }, { status: 400 })

    const simulado = await prisma.simulado.findFirst({
      where: { id: simuladoId, userId: user.id, deletedAt: null },
      select: { questoesJson: true },
    })
    if (!simulado) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 })

    const activeKey = `${user.id}:${simuladoId}`
    const tentativa = await prisma.tentativa.findUnique({ where: { activeKey } })
      ?? await prisma.tentativa.findFirst({
        where: { simuladoId, userId: user.id, concluidoEm: { not: null } },
        orderBy: { concluidoEm: 'desc' },
      })
    if (!tentativa) return NextResponse.json({ progress: null })

    const answers = parseAnswers(tentativa.respostas)
    const evaluations = Object.fromEntries(
      (JSON.parse(simulado.questoesJson) as Question[])
        .filter((question) => answers[question.id] !== undefined)
        .map((question) => [question.id, evaluateAnswer(question, answers[question.id])]),
    )

    const storedElapsedSeconds = tentativa.durationSeconds ?? 0
    const elapsedSeconds = !tentativa.concluidoEm && storedElapsedSeconds > 12 * 60 * 60
      ? 0
      : storedElapsedSeconds

    return NextResponse.json({
      progress: {
        currentIndex: tentativa.currentIndex,
        selectedAnswers: parseAnswers(tentativa.selectedAnswers),
        respostas: answers,
        evaluations,
        completed: Boolean(tentativa.concluidoEm),
        elapsedSeconds,
        result: tentativa.concluidoEm ? {
          score: tentativa.pontuacao,
          percentage: tentativa.percentual,
          durationSeconds: tentativa.durationSeconds,
          completedAt: tentativa.concluidoEm.toISOString(),
        } : null,
      },
    })
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
