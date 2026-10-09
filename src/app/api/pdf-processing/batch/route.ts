import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/server-auth';
import {
  getVectorDocument,
  MAX_BATCH_TEXT_LENGTH,
  PDF_PAGE_BATCH_SIZE,
  processVectorBatch,
} from '@/lib/document-vector-store';
import { checkPdfBatchRateLimit, getClientIp } from '@/lib/rate-limit';
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const pageSchema = z.object({
  pageNumber: z.number().int().min(1).max(400),
  text: z.string().max(200_000),
}).strict();

const batchSchema = z.object({
  documentId: z.string().uuid(),
  batchIndex: z.number().int().min(0).max(79),
  pages: z.array(pageSchema).min(1).max(PDF_PAGE_BATCH_SIZE),
}).strict();

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: true, batchIndex: 0 });
  }
  const userId = (await getAuthenticatedUser(request))?.id;
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!isSupabaseVectorConfigured()) {
    return NextResponse.json({ error: 'Processamento em lotes não configurado' }, { status: 503 });
  }
  const ipLimit = await checkPdfBatchRateLimit(getClientIp(request));
  if (!ipLimit.allowed) return NextResponse.json({ error: 'Muitas solicitações.' }, { status: 429 });

  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Lote inválido' }, { status: 400 });
  const { documentId, batchIndex, pages } = parsed.data;
  if (pages.reduce((sum, page) => sum + page.text.length, 0) > MAX_BATCH_TEXT_LENGTH) {
    return NextResponse.json({ error: 'O lote possui texto demais.' }, { status: 413 });
  }

  try {
    const document = await getVectorDocument(documentId, userId);
    if (!document) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    if (document.expires_at && new Date(document.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'A sessão de processamento expirou.' }, { status: 410 });
    }
    if (batchIndex >= document.total_batches) {
      return NextResponse.json({ error: 'Índice do lote inválido.' }, { status: 400 });
    }

    const expectedStart = batchIndex * PDF_PAGE_BATCH_SIZE + 1;
    const expectedEnd = Math.min(document.total_pages, expectedStart + PDF_PAGE_BATCH_SIZE - 1);
    const receivedPages = pages.map((page) => page.pageNumber);
    const expectedPages = Array.from({ length: expectedEnd - expectedStart + 1 }, (_, index) => expectedStart + index);
    if (receivedPages.some((page, index) => page !== expectedPages[index]) || receivedPages.length !== expectedPages.length) {
      return NextResponse.json({ error: 'As páginas do lote estão incompletas ou fora de ordem.' }, { status: 400 });
    }

    const result = await processVectorBatch({ document, batchIndex, pages });
    return NextResponse.json({ success: true, batchIndex, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('PDF vector batch failed:', message);
    if (message === 'BATCH_TOO_DENSE') {
      return NextResponse.json({ error: 'O lote gerou trechos demais para processamento seguro.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Não foi possível processar este lote.' }, { status: 500 });
  }
}
