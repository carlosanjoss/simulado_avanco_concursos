import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { generateQuizBatchWithFallback } from '@/lib/ai-providers'
import { embedTexts, vectorizePdfText } from '@/lib/embeddings'
import { extractTextFromPDF, validatePDFBuffer, validatePDFFile } from '@/lib/pdf-utils'
import { buildQuizPrompts } from '@/lib/prompts/quiz-generation'
import { prisma } from '@/lib/prisma'
import { quizSchema } from '@/lib/validations/quiz'
import {
  DUPLICATE_REPAIR_ATTEMPTS,
  findDuplicateQuestionIds,
  getQuestionQualityIssues,
  mapWithConcurrency,
  QUESTION_GENERATION_ATTEMPTS,
  QUESTION_GENERATION_CONCURRENCY,
} from '@/lib/question-generation'
import { checkIpRateLimit, getClientIp } from '@/lib/rate-limit'
import { releaseMonthlyGeneration, reserveMonthlyGeneration } from '@/lib/usage-limit'
import {
  getDocumentQuestionContexts,
  getVectorDocument,
  getVectorDocumentChunkCount,
  markVectorMaterialUsed,
} from '@/lib/document-vector-store'
import type { RetrievedQuestionContext } from '@/lib/document-vector-store'
import type { VectorDocument } from '@/lib/document-vector-store'
import type { Question } from '@/types/quiz'
import { getAuthenticatedUser } from '@/lib/server-auth'

const MAX_FOCUS_LENGTH = 500
const ALLOWED_QUESTION_COUNTS = new Set([10, 20, 30, 40, 50])
const ALLOWED_DIFFICULTIES = new Set(['Fácil', 'Médio', 'Avançado', 'Misto'])
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type ErrorCode =
  | 'UNAUTHORIZED' | 'INVALID_FILE' | 'FILE_TOO_LARGE' | 'EMPTY_PDF'
  | 'PDF_PARSE_ERROR' | 'PDF_TOO_MANY_PAGES' | 'MONTHLY_LIMIT_REACHED' | 'AI_UNAVAILABLE'
  | 'INVALID_AI_RESPONSE' | 'VECTOR_DOCUMENT_ERROR' | 'DATABASE_ERROR' | 'INTERNAL_ERROR'

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status })
}

function sanitizeFocus(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return undefined
  return value.slice(0, MAX_FOCUS_LENGTH).replace(/[<>\"'`]/g, '').trim() || undefined
}

function allocateQuestions(total: number, documentIds: string[], weights: Record<string, number>): number[] {
  if (documentIds.length === 1) return [total]
  const safeWeights = documentIds.map((id) => Math.max(1, Math.min(100, weights[id] || 1)))
  const remaining = total - documentIds.length
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0)
  const raw = safeWeights.map((weight) => remaining * weight / weightTotal)
  const allocations = raw.map((value) => 1 + Math.floor(value))
  let pending = total - allocations.reduce((sum, value) => sum + value, 0)
  const priority = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction)
  for (let index = 0; index < pending; index += 1) allocations[priority[index].index] += 1
  return allocations
}

export interface GenerationProgressEvent {
  phase: 'retrieving' | 'generating' | 'deduplicating' | 'saving'
  completed: number
  total: number
  failed: number
  attempt: number
  message: string
}

type ProgressReporter = (event: GenerationProgressEvent) => void | Promise<void>

async function audit(data: {
  userId?: string
  provider?: string
  status: string
  durationMs: number
  errorMessage?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: 'generate_quiz',
        provider: data.provider,
        durationMs: data.durationMs,
        status: data.status,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}

async function getUserFromRequest(request: NextRequest) {
  return getAuthenticatedUser(request)
}

async function generateQuizResponse(request: NextRequest, reportProgress?: ProgressReporter) {
  const startedAt = Date.now()

  const user = await getUserFromRequest(request)
  if (!user) return errorResponse('UNAUTHORIZED', 'Faça login para gerar um simulado.', 401)

  const ipLimit = await checkIpRateLimit(getClientIp(request))
  if (!ipLimit.allowed) return errorResponse('AI_UNAVAILABLE', 'Muitas solicitações. Tente novamente mais tarde.', 429)

  let usageReserved = false
  let userEmail = user.email

  try {
    const formData = await request.formData()
    const fileEntry = formData.get('file') ?? formData.get('pdf')
    const documentIdEntry = formData.get('documentId')
    const documentIdsEntry = formData.get('documentIds')
    let documentIds: string[] = []
    if (typeof documentIdsEntry === 'string' && documentIdsEntry) {
      try {
        const parsed = JSON.parse(documentIdsEntry)
        if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) throw new Error('INVALID_DOCUMENT_IDS')
        documentIds = parsed as string[]
      } catch {
        return errorResponse('VECTOR_DOCUMENT_ERROR', 'A seleção de materiais é inválida.', 400)
      }
    } else if (typeof documentIdEntry === 'string') {
      documentIds = [documentIdEntry]
    }
    documentIds = Array.from(new Set(documentIds))
    if (documentIds.length > 5 || documentIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return errorResponse('VECTOR_DOCUMENT_ERROR', 'Selecione no máximo cinco materiais válidos.', 400)
    }
    let materialWeights: Record<string, number> = {}
    const materialWeightsEntry = formData.get('materialWeights')
    if (typeof materialWeightsEntry === 'string' && materialWeightsEntry) {
      try {
        const parsed = JSON.parse(materialWeightsEntry) as Record<string, unknown>
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.entries(parsed).some(([id, value]) => !documentIds.includes(id) || typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 100)) throw new Error('INVALID_MATERIAL_WEIGHTS')
        materialWeights = parsed as Record<string, number>
      } catch {
        return errorResponse('VECTOR_DOCUMENT_ERROR', 'A distribuição entre materiais é inválida.', 400)
      }
    }
    const focusTopics = sanitizeFocus(formData.get('focusTopics') ?? formData.get('temasFoco'))
    const requestedCount = Number(formData.get('questionCount') || 30)
    if (!ALLOWED_QUESTION_COUNTS.has(requestedCount)) {
      return errorResponse('INVALID_AI_RESPONSE', 'Escolha 10, 20, 30, 40 ou 50 questões.', 400)
    }
    const requestedDifficulty = String(formData.get('difficulty') || 'Misto')
    if (!ALLOWED_DIFFICULTIES.has(requestedDifficulty)) {
      return errorResponse('INVALID_AI_RESPONSE', 'Dificuldade inválida.', 400)
    }
    const questionCount = requestedCount
    const difficultyTarget = requestedDifficulty as 'Fácil' | 'Médio' | 'Avançado' | 'Misto'
    let ocrUsed = formData.get('ocrUsed') === 'true'
    if (!documentIds.length && !(fileEntry instanceof File)) {
      return errorResponse('INVALID_FILE', 'Selecione ao menos um material ou arquivo PDF.', 400)
    }

    let pdfHash = ''
    let pdfName = ''
    let pageCount = 0
    let chunkCount = 0
    let questionContexts = new Map<number, RetrievedQuestionContext>()
    let uploadedBuffer: Buffer | undefined
    let vectorDocuments: VectorDocument[] = []

    if (documentIds.length) {
      const loadedDocuments = await Promise.all(documentIds.map((id) => getVectorDocument(id, user.id)))
      if (loadedDocuments.some((document) => !document || document.status !== 'ready')) {
        return errorResponse('VECTOR_DOCUMENT_ERROR', 'Um ou mais materiais não estão disponíveis.', 409)
      }
      vectorDocuments = loadedDocuments as VectorDocument[]
      ocrUsed = vectorDocuments.some((document) => document.ocr_pages > 0)
      const combinedHash = createHash('sha256')
      vectorDocuments.forEach((document) => combinedHash.update(document.file_hash))
      pdfHash = combinedHash.update(focusTopics || '').update(String(questionCount)).update(difficultyTarget).digest('hex')
      pdfName = vectorDocuments.map((document) => document.file_name).join(' + ')
      pageCount = vectorDocuments.reduce((sum, document) => sum + document.total_pages, 0)
    } else {
      const pdfFile = fileEntry as File
      const fileValidation = validatePDFFile(pdfFile)
      if (!fileValidation.valid) {
        const tooLarge = pdfFile.size > 20 * 1024 * 1024
        return errorResponse(tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_FILE', fileValidation.error!, 400)
      }
      pdfName = pdfFile.name
      uploadedBuffer = Buffer.from(await pdfFile.arrayBuffer())
      const signatureValidation = validatePDFBuffer(uploadedBuffer)
      if (!signatureValidation.valid) {
        return errorResponse('INVALID_FILE', signatureValidation.error!, 400)
      }
      pdfHash = createHash('sha256').update(uploadedBuffer).update(focusTopics || '').update(String(questionCount)).update(difficultyTarget).digest('hex')
    }

    usageReserved = await reserveMonthlyGeneration(user.id, userEmail)
    if (!usageReserved) return errorResponse('MONTHLY_LIMIT_REACHED', 'Você atingiu o limite mensal do seu plano.', 429)

    if (vectorDocuments.length) {
      await reportProgress?.({
        phase: 'retrieving', completed: 0, total: questionCount, failed: 0, attempt: 1,
        message: `Distribuindo questões entre ${vectorDocuments.length} material(is)...`,
      })
      let globalQuestionId = 1
      const allocations = allocateQuestions(questionCount, documentIds, materialWeights)
      for (let documentIndex = 0; documentIndex < vectorDocuments.length; documentIndex += 1) {
        const document = vectorDocuments[documentIndex]
        const allocatedCount = allocations[documentIndex]
        const localContexts = await getDocumentQuestionContexts(document, focusTopics, allocatedCount)
        for (let localId = 1; localId <= allocatedCount; localId += 1) {
          const context = localContexts.get(localId)
          if (context) questionContexts.set(globalQuestionId, context)
          globalQuestionId += 1
        }
        chunkCount += await getVectorDocumentChunkCount(document.id)
        await markVectorMaterialUsed(document.id, user.id)
      }
    } else {
      const buffer = uploadedBuffer!
      let extracted
      try {
        extracted = await extractTextFromPDF(buffer)
      } catch (error) {
        if (error instanceof Error && error.message === 'PDF_TOO_MANY_PAGES') throw error
        throw new Error('PDF_PARSE_ERROR')
      }
      if (extracted.text.length < 100) throw new Error('EMPTY_PDF')
      const ephemeralContext = await vectorizePdfText(extracted.text, focusTopics)
      pageCount = extracted.pageCount
      chunkCount = ephemeralContext.chunks.length
      questionContexts = new Map(
        Array.from({ length: questionCount }, (_, index) => [index + 1, {
          text: ephemeralContext.contextText,
          sources: [],
          pageWindow: { from: 1, to: extracted.pageCount },
          objective: 'principais conceitos, fatos e argumentos',
          domain: 'general' as const,
        }]),
      )
    }

    const providersUsed = new Set<string>()
    let quizTitle = ''
    const questionsById = new Map<number, Question>()
    const failureReasons = new Map<number, string>()
    let currentGenerationAttempt = 1

    const generateQuestionIds = async (questionIds: number[], avoidQuestions?: string[]) => {
      const failedIds: number[] = []
      await mapWithConcurrency(questionIds, QUESTION_GENERATION_CONCURRENCY, async (questionId) => {
        const questionContext = questionContexts.get(questionId)
        const prompts = buildQuizPrompts({
          context: questionContext?.text || '',
          focusTopics,
          domain: questionContext?.domain,
          retrievalObjective: questionContext?.objective,
          totalQuestions: questionCount,
          difficultyTarget,
          batch: {
            number: questionId,
            startId: questionId,
            endId: questionId,
            previousQuestions: Array.from(questionsById.values()).map((question) => question.enunciado),
          },
          avoidQuestions,
        })
        try {
          const { batch, providerUsed } = await generateQuizBatchWithFallback(
            prompts.systemPrompt,
            prompts.userPrompt,
            questionId,
          )
          quizTitle ||= batch.titulo
          const question = batch.questoes[0]
          const qualityIssues = getQuestionQualityIssues(question)
          if (qualityIssues.length > 0) {
            throw new Error(`INVALID_AI_QUALITY: ${qualityIssues.join('; ')}`)
          }
          const sources = questionContext?.sources || []
          question.sources = sources
          if (sources.length > 0 && !/p[aá]gina\s+\d+/i.test(question.justificativa)) {
            const pages = Array.from(new Set(sources.map((source) => source.pageNumber))).slice(0, 4)
            question.justificativa = `${question.justificativa} Fonte: ${pages.length === 1 ? 'Página' : 'Páginas'} ${pages.join(', ')}.`
          }
          questionsById.set(questionId, question)
          providersUsed.add(providerUsed)
          failureReasons.delete(questionId)
        } catch (error) {
          failedIds.push(questionId)
          failureReasons.set(questionId, error instanceof Error ? error.message : 'Erro desconhecido')
        }
        await reportProgress?.({
          phase: 'generating', completed: questionsById.size, total: questionCount,
          failed: failedIds.length, attempt: currentGenerationAttempt,
          message: `${questionsById.size} de ${questionCount} questões concluídas`,
        })
      })
      return failedIds.sort((a, b) => a - b)
    }

    let pendingIds = Array.from({ length: questionCount }, (_, index) => index + 1)
    for (let attempt = 1; attempt <= QUESTION_GENERATION_ATTEMPTS && pendingIds.length > 0; attempt += 1) {
      currentGenerationAttempt = attempt
      pendingIds = await generateQuestionIds(pendingIds)
    }
    if (pendingIds.length > 0) {
      const errors = pendingIds.map((id) => `Questão ${id}: ${failureReasons.get(id) || 'falhou'}`).join('; ')
      throw new Error(`INVALID_AI_RESPONSE: ${errors}`)
    }

    for (let repair = 0; repair < DUPLICATE_REPAIR_ATTEMPTS; repair += 1) {
      const currentQuestions = Array.from(questionsById.values()).sort((a, b) => a.id - b.id)
      await reportProgress?.({
        phase: 'deduplicating', completed: currentQuestions.length, total: questionCount,
        failed: 0, attempt: repair + 1, message: 'Verificando questões duplicadas...',
      })
      const duplicateIds = findDuplicateQuestionIds(currentQuestions).sort((a, b) => a - b)
      if (duplicateIds.length === 0) break
      const avoidQuestions = duplicateIds.map(id => currentQuestions.find(q => q.id === id)?.enunciado).filter(Boolean) as string[]
      duplicateIds.forEach((id) => questionsById.delete(id))
      const failedDuplicateIds = await generateQuestionIds(duplicateIds, avoidQuestions)
      if (failedDuplicateIds.length > 0) {
        throw new Error(`INVALID_AI_RESPONSE: falha ao regenerar questões duplicadas ${failedDuplicateIds.join(', ')}`)
      }
    }

    const generatedQuestions = Array.from(questionsById.values()).sort((a, b) => a.id - b.id)
    const remainingDuplicates = findDuplicateQuestionIds(generatedQuestions).sort((a, b) => a - b)
    if (remainingDuplicates.length > 0) {
      throw new Error(`INVALID_AI_RESPONSE: questões duplicadas persistentes ${remainingDuplicates.join(', ')}`)
    }

    if (generatedQuestions.length !== questionCount) {
      throw new Error(`INVALID_AI_RESPONSE: Expected ${questionCount} questions, got ${generatedQuestions.length}`)
    }
    const quiz = quizSchema.parse({ titulo: quizTitle, total_questoes: questionCount, questoes: generatedQuestions })
    const providerUsed = Array.from(providersUsed).join(' → ')

    await reportProgress?.({
      phase: 'saving', completed: questionCount, total: questionCount,
      failed: 0, attempt: 1, message: 'Salvando simulado e fontes utilizadas...',
    })
    const saved = await prisma.simulado.create({
      data: {
        userId: user.id,
        titulo: quiz.titulo,
        totalQuestoes: questionCount,
        temasFoco: focusTopics,
        pdfNome: pdfName,
        pdfHash,
        questoesJson: JSON.stringify(quiz.questoes),
        sourceDocumentId: documentIds[0],
        materials: vectorDocuments.length ? { create: vectorDocuments.map((document) => ({ documentId: document.id, fileName: document.file_name })) } : undefined,
        difficultyTarget: difficultyTarget.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        ocrUsed,
      },
    })

    await audit({
      userId: user.id,
      provider: providerUsed,
      status: 'success',
      durationMs: Date.now() - startedAt,
      metadata: { quizId: saved.id, pageCount, chunks: chunkCount, vectorBatching: vectorDocuments.length > 0, materialCount: vectorDocuments.length, documentIds, materialWeights, questionCount, difficultyTarget, ocrUsed },
    })
    return NextResponse.json({ success: true, quizId: saved.id })
  } catch (error) {
    if (usageReserved) await releaseMonthlyGeneration(user.id, userEmail)
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    console.error('[GERADOR ERROR]', { message, stack: error instanceof Error ? error.stack : undefined, userId: user.id })
    Sentry.captureException(error)
    await audit({ userId: user.id, status: 'error', durationMs: Date.now() - startedAt, errorMessage: message })

    if (message === 'EMPTY_PDF') return errorResponse('EMPTY_PDF', 'Não conseguimos extrair texto suficiente desse PDF.', 400)
    if (message === 'PDF_PARSE_ERROR') return errorResponse('PDF_PARSE_ERROR', 'O PDF está corrompido ou não pôde ser processado.', 400)
    if (message === 'PDF_TOO_MANY_PAGES') return errorResponse('PDF_TOO_MANY_PAGES', 'O PDF excede o limite de 400 páginas.', 400)
    if (message.startsWith('VECTOR_')) return errorResponse('VECTOR_DOCUMENT_ERROR', 'Não foi possível consultar os trechos processados do PDF.', 503)
    if (message.startsWith('INVALID_AI_')) return errorResponse('INVALID_AI_RESPONSE', 'A IA retornou um simulado inválido. Tente novamente.', 503)
    if (/AI_UNAVAILABLE|fetch failed|timeout|HTTP|Empty response/i.test(message)) {
      return errorResponse('AI_UNAVAILABLE', 'Os serviços de IA estão temporariamente indisponíveis. Tente novamente mais tarde.', 503)
    }
    if (/prisma|database/i.test(message)) return errorResponse('DATABASE_ERROR', 'Não foi possível salvar o simulado.', 500)
    return errorResponse('INTERNAL_ERROR', 'Ocorreu um erro inesperado. Tente novamente.', 500)
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('accept')?.includes('application/x-ndjson')) {
    return generateQuizResponse(request)
  }

  const encoder = new TextEncoder()
  let canceled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }
      void generateQuizResponse(request, (progress) => emit({ type: 'progress', ...progress }))
        .then(async (response) => {
          const payload = await response.json().catch(() => ({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'A resposta final do servidor é inválida.',
          }))
          if (response.ok && payload.success) emit({ type: 'complete', ...payload })
          else emit({ type: 'error', status: response.status, ...payload })
        })
        .catch((error) => {
          emit({
            type: 'error', code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro inesperado na geração.',
          })
        })
        .finally(() => {
          if (!canceled) controller.close()
        })
    },
    cancel() {
      canceled = true
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
