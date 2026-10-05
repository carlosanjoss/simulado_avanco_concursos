import { createHash } from 'node:crypto';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateQuizBatchWithFallback, TOTAL_BATCHES } from '@/lib/ai-providers';
import { embedTexts, vectorizePdfText } from '@/lib/embeddings';
import { extractTextFromPDF, validatePDFBuffer, validatePDFFile } from '@/lib/pdf-utils';
import { buildQuizPrompts } from '@/lib/prompts/quiz-generation';
import { prisma } from '@/lib/prisma';
import { quizSchema } from '@/lib/validations/quiz';
import {
  DUPLICATE_REPAIR_ATTEMPTS,
  findDuplicateQuestionIds,
  findSemanticDuplicateQuestionIds,
  getQuestionQualityIssues,
  mapWithConcurrency,
  QUESTION_GENERATION_ATTEMPTS,
  QUESTION_GENERATION_CONCURRENCY,
} from '@/lib/question-generation';
import { checkIpRateLimit, getClientIp } from '@/lib/rate-limit';
import { releaseMonthlyGeneration, reserveMonthlyGeneration } from '@/lib/usage-limit';
import {
  getDocumentQuestionContexts,
  getVectorDocument,
  getVectorDocumentChunkCount,
} from '@/lib/document-vector-store';
import type { RetrievedQuestionContext } from '@/lib/document-vector-store';
import type { Question } from '@/types/quiz';

const MAX_FOCUS_LENGTH = 500;
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type ErrorCode =
  | 'UNAUTHORIZED' | 'INVALID_FILE' | 'FILE_TOO_LARGE' | 'EMPTY_PDF'
  | 'PDF_PARSE_ERROR' | 'PDF_TOO_MANY_PAGES' | 'MONTHLY_LIMIT_REACHED' | 'AI_UNAVAILABLE'
  | 'INVALID_AI_RESPONSE' | 'VECTOR_DOCUMENT_ERROR' | 'DATABASE_ERROR' | 'INTERNAL_ERROR';

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

function sanitizeFocus(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, MAX_FOCUS_LENGTH).replace(/[<>"'`]/g, '').trim() || undefined;
}

export interface GenerationProgressEvent {
  phase: 'retrieving' | 'generating' | 'deduplicating' | 'saving';
  completed: number;
  total: number;
  failed: number;
  attempt: number;
  message: string;
}

type ProgressReporter = (event: GenerationProgressEvent) => void | Promise<void>;

async function audit(data: {
  userId?: string;
  provider?: string;
  status: string;
  durationMs: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
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
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

async function generateQuizResponse(request: NextRequest, reportProgress?: ProgressReporter) {
  const startedAt = Date.now();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return errorResponse('UNAUTHORIZED', 'Faça login para gerar um simulado.', 401);

  const ipLimit = checkIpRateLimit(getClientIp(request));
  if (!ipLimit.allowed) return errorResponse('AI_UNAVAILABLE', 'Muitas solicitações. Tente novamente mais tarde.', 429);

  let internalUserId: string | undefined;
  let usageReserved = false;
  let userEmail: string | undefined;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file') ?? formData.get('pdf');
    const documentIdEntry = formData.get('documentId');
    const documentId = typeof documentIdEntry === 'string' && /^[0-9a-f-]{36}$/i.test(documentIdEntry)
      ? documentIdEntry
      : undefined;
    const focusTopics = sanitizeFocus(formData.get('focusTopics') ?? formData.get('temasFoco'));
    if (!documentId && !(fileEntry instanceof File)) {
      return errorResponse('INVALID_FILE', 'Selecione um arquivo PDF.', 400);
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
    userEmail = primaryEmail && !primaryEmail.includes('@users.invalid')
      ? primaryEmail
      : `${clerkUserId}@users.invalid`;
    const user = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: {
        email: userEmail,
        name: clerkUser?.fullName || undefined,
        imageUrl: clerkUser?.imageUrl || undefined,
      },
      create: {
        clerkId: clerkUserId,
        email: userEmail,
        name: clerkUser?.fullName || undefined,
        imageUrl: clerkUser?.imageUrl || undefined,
      },
    });
    internalUserId = user.id;

    let pdfHash = '';
    let pdfName = '';
    let pageCount = 0;
    let chunkCount = 0;
    let questionContexts = new Map<number, RetrievedQuestionContext>();
    let uploadedBuffer: Buffer | undefined;

    if (documentId) {
      const vectorDocument = await getVectorDocument(documentId, clerkUserId);
      if (!vectorDocument || vectorDocument.status !== 'ready') {
        return errorResponse('VECTOR_DOCUMENT_ERROR', 'O processamento do PDF não foi concluído.', 409);
      }
      pdfHash = createHash('sha256').update(vectorDocument.file_hash).update(focusTopics || '').digest('hex');
      pdfName = vectorDocument.file_name;
      pageCount = vectorDocument.total_pages;
    } else {
      const pdfFile = fileEntry as File;
      const fileValidation = validatePDFFile(pdfFile);
      if (!fileValidation.valid) {
        const tooLarge = pdfFile.size > 20 * 1024 * 1024;
        return errorResponse(tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_FILE', fileValidation.error!, 400);
      }
      pdfName = pdfFile.name;
      uploadedBuffer = Buffer.from(await pdfFile.arrayBuffer());
      const signatureValidation = validatePDFBuffer(uploadedBuffer);
      if (!signatureValidation.valid) {
        return errorResponse('INVALID_FILE', signatureValidation.error!, 400);
      }
      pdfHash = createHash('sha256').update(uploadedBuffer).update(focusTopics || '').digest('hex');
    }

    usageReserved = await reserveMonthlyGeneration(user.id, userEmail);
    if (!usageReserved) return errorResponse('MONTHLY_LIMIT_REACHED', 'Você atingiu o limite mensal de 2 simulados.', 429);

    if (documentId) {
      const vectorDocument = await getVectorDocument(documentId, clerkUserId);
      if (!vectorDocument) throw new Error('VECTOR_DOCUMENT_NOT_FOUND');
      await reportProgress?.({
        phase: 'retrieving', completed: 0, total: TOTAL_BATCHES, failed: 0, attempt: 1,
        message: 'Selecionando fontes diferentes para cada questão...',
      });
      questionContexts = await getDocumentQuestionContexts(vectorDocument, focusTopics);
      chunkCount = await getVectorDocumentChunkCount(vectorDocument.id);
    } else {
      const buffer = uploadedBuffer!;
      let extracted;
      try {
        extracted = await extractTextFromPDF(buffer);
      } catch (error) {
        if (error instanceof Error && error.message === 'PDF_TOO_MANY_PAGES') throw error;
        throw new Error('PDF_PARSE_ERROR');
      }
      if (extracted.text.length < 100) throw new Error('EMPTY_PDF');
      const ephemeralContext = await vectorizePdfText(extracted.text, focusTopics);
      pageCount = extracted.pageCount;
      chunkCount = ephemeralContext.chunks.length;
      questionContexts = new Map(
        Array.from({ length: TOTAL_BATCHES }, (_, index) => [index + 1, {
          text: ephemeralContext.contextText,
          sources: [],
          pageWindow: { from: 1, to: extracted.pageCount },
          objective: 'principais conceitos, fatos e argumentos',
          domain: 'general' as const,
        }]),
      );
    }

    const providersUsed = new Set<string>();
    let quizTitle = '';
    const questionsById = new Map<number, Question>();
    const failureReasons = new Map<number, string>();
    let currentGenerationAttempt = 1;

    const generateQuestionIds = async (questionIds: number[]) => {
      const failedIds: number[] = [];
      await mapWithConcurrency(questionIds, QUESTION_GENERATION_CONCURRENCY, async (questionId) => {
        const questionContext = questionContexts.get(questionId);
        const prompts = buildQuizPrompts({
          context: questionContext?.text || '',
          focusTopics,
          domain: questionContext?.domain,
          retrievalObjective: questionContext?.objective,
          batch: {
            number: questionId,
            startId: questionId,
            endId: questionId,
            previousQuestions: Array.from(questionsById.values()).map((question) => question.enunciado),
          },
        });
        try {
          const { batch, providerUsed } = await generateQuizBatchWithFallback(
            prompts.systemPrompt,
            prompts.userPrompt,
            questionId,
          );
          quizTitle ||= batch.titulo;
          const question = batch.questoes[0];
          const qualityIssues = getQuestionQualityIssues(question, questionContext?.domain || 'general');
          if (qualityIssues.length > 0) {
            throw new Error(`INVALID_AI_QUALITY: ${qualityIssues.join('; ')}`);
          }
          const sources = questionContext?.sources || [];
          question.sources = sources;
          if (sources.length > 0 && !/p[aá]gina\s+\d+/i.test(question.justificativa)) {
            const pages = Array.from(new Set(sources.map((source) => source.pageNumber))).slice(0, 4);
            question.justificativa = `${question.justificativa} Fonte: ${pages.length === 1 ? 'Página' : 'Páginas'} ${pages.join(', ')}.`;
          }
          questionsById.set(questionId, question);
          providersUsed.add(providerUsed);
          failureReasons.delete(questionId);
        } catch (error) {
          failedIds.push(questionId);
          failureReasons.set(questionId, error instanceof Error ? error.message : 'Erro desconhecido');
        }
        await reportProgress?.({
          phase: 'generating', completed: questionsById.size, total: TOTAL_BATCHES,
          failed: failedIds.length, attempt: currentGenerationAttempt,
          message: `${questionsById.size} de ${TOTAL_BATCHES} questões concluídas`,
        });
      });
      return failedIds.sort((a, b) => a - b);
    };

    let pendingIds = Array.from({ length: TOTAL_BATCHES }, (_, index) => index + 1);
    for (let attempt = 1; attempt <= QUESTION_GENERATION_ATTEMPTS && pendingIds.length > 0; attempt += 1) {
      currentGenerationAttempt = attempt;
      pendingIds = await generateQuestionIds(pendingIds);
    }
    if (pendingIds.length > 0) {
      const errors = pendingIds.map((id) => `Questão ${id}: ${failureReasons.get(id) || 'falhou'}`).join('; ');
      throw new Error(`INVALID_AI_RESPONSE: ${errors}`);
    }

    for (let repair = 0; repair < DUPLICATE_REPAIR_ATTEMPTS; repair += 1) {
      const currentQuestions = Array.from(questionsById.values()).sort((a, b) => a.id - b.id);
      await reportProgress?.({
        phase: 'deduplicating', completed: currentQuestions.length, total: TOTAL_BATCHES,
        failed: 0, attempt: repair + 1, message: 'Comparando semanticamente as questões...',
      });
      const semanticEmbeddings = await embedTexts(currentQuestions.map((question) => question.enunciado));
      const duplicateIds = Array.from(new Set([
        ...findDuplicateQuestionIds(currentQuestions),
        ...findSemanticDuplicateQuestionIds(currentQuestions, semanticEmbeddings),
      ])).sort((a, b) => a - b);
      if (duplicateIds.length === 0) break;
      duplicateIds.forEach((id) => questionsById.delete(id));
      const failedDuplicateIds = await generateQuestionIds(duplicateIds);
      if (failedDuplicateIds.length > 0) {
        throw new Error(`INVALID_AI_RESPONSE: falha ao regenerar questões duplicadas ${failedDuplicateIds.join(', ')}`);
      }
    }

    const generatedQuestions = Array.from(questionsById.values()).sort((a, b) => a.id - b.id);
    const finalEmbeddings = await embedTexts(generatedQuestions.map((question) => question.enunciado));
    const remainingDuplicates = Array.from(new Set([
      ...findDuplicateQuestionIds(generatedQuestions),
      ...findSemanticDuplicateQuestionIds(generatedQuestions, finalEmbeddings),
    ])).sort((a, b) => a - b);
    if (remainingDuplicates.length > 0) {
      throw new Error(`INVALID_AI_RESPONSE: questões duplicadas persistentes ${remainingDuplicates.join(', ')}`);
    }

    if (generatedQuestions.length !== 30) {
      throw new Error(`INVALID_AI_RESPONSE: Expected 30 questions, got ${generatedQuestions.length}`);
    }
    const quiz = quizSchema.parse({ titulo: quizTitle, total_questoes: 30, questoes: generatedQuestions });
    const providerUsed = Array.from(providersUsed).join(' → ');

    await reportProgress?.({
      phase: 'saving', completed: TOTAL_BATCHES, total: TOTAL_BATCHES,
      failed: 0, attempt: 1, message: 'Salvando simulado e fontes utilizadas...',
    });
    const saved = await prisma.simulado.create({
      data: {
        userId: user.id,
        titulo: quiz.titulo,
        totalQuestoes: 30,
        temasFoco: focusTopics,
        pdfNome: pdfName,
        pdfHash,
        questoesJson: JSON.stringify(quiz.questoes),
      },
    });

    await audit({
      userId: clerkUserId,
      provider: providerUsed,
      status: 'success',
      durationMs: Date.now() - startedAt,
      metadata: { quizId: saved.id, pageCount, chunks: chunkCount, vectorBatching: Boolean(documentId) },
    });
    // Os vetores permanecem por sete dias para auditoria e são removidos pelo
    // job de expiração. As fontes essenciais também ficam salvas em questoesJson.
    return NextResponse.json({ success: true, quizId: saved.id });
  } catch (error) {
    if (usageReserved && internalUserId) await releaseMonthlyGeneration(internalUserId, userEmail);
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    console.error('[GERADOR ERROR]', { message, stack: error instanceof Error ? error.stack : undefined, clerkUserId });
    await audit({ userId: clerkUserId, status: 'error', durationMs: Date.now() - startedAt, errorMessage: message });

    if (message === 'EMPTY_PDF') return errorResponse('EMPTY_PDF', 'Não conseguimos extrair texto suficiente desse PDF.', 400);
    if (message === 'PDF_PARSE_ERROR') return errorResponse('PDF_PARSE_ERROR', 'O PDF está corrompido ou não pôde ser processado.', 400);
    if (message === 'PDF_TOO_MANY_PAGES') return errorResponse('PDF_TOO_MANY_PAGES', 'O PDF excede o limite de 400 páginas.', 400);
    if (message.startsWith('VECTOR_')) return errorResponse('VECTOR_DOCUMENT_ERROR', 'Não foi possível consultar os trechos processados do PDF.', 503);
    if (message.startsWith('INVALID_AI_')) return errorResponse('INVALID_AI_RESPONSE', 'A IA retornou um simulado inválido. Tente novamente.', 503);
    if (/AI_UNAVAILABLE|fetch failed|timeout|HTTP|Empty response/i.test(message)) {
      return errorResponse('AI_UNAVAILABLE', 'Os serviços de IA estão temporariamente indisponíveis. Tente novamente mais tarde.', 503);
    }
    if (/prisma|database/i.test(message)) return errorResponse('DATABASE_ERROR', 'Não foi possível salvar o simulado.', 500);
    return errorResponse('INTERNAL_ERROR', 'Ocorreu um erro inesperado. Tente novamente.', 500);
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('accept')?.includes('application/x-ndjson')) {
    return generateQuizResponse(request);
  }

  const encoder = new TextEncoder();
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      void generateQuizResponse(request, (progress) => emit({ type: 'progress', ...progress }))
        .then(async (response) => {
          const payload = await response.json().catch(() => ({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'A resposta final do servidor é inválida.',
          }));
          if (response.ok && payload.success) emit({ type: 'complete', ...payload });
          else emit({ type: 'error', status: response.status, ...payload });
        })
        .catch((error) => {
          emit({
            type: 'error', code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro inesperado na geração.',
          });
        })
        .finally(() => {
          if (!canceled) controller.close();
        });
    },
    cancel() {
      canceled = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
