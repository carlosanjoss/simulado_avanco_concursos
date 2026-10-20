import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/server-auth';
import {
  createVectorDocument,
  deleteVectorDocument,
  getVectorDocumentChunkCount,
  getOcrDocumentSummary,
  PDF_PAGE_BATCH_SIZE,
  vectorStoreMetadata,
  listVectorMaterials,
} from '@/lib/document-vector-store';
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin';
import { getUserPlanAccess } from '@/lib/plan-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sessionSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  totalPages: z.number().int().min(1).max(400),
  totalBatches: z.number().int().min(1).max(80),
}).strict().superRefine((value, context) => {
  if (value.totalBatches !== Math.ceil(value.totalPages / PDF_PAGE_BATCH_SIZE)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['totalBatches'], message: 'Quantidade de lotes inválida.' });
  }
});

async function getUserId(request: NextRequest): Promise<string | null> {
  return (await getAuthenticatedUser(request))?.id ?? null
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: true, documentId: '00000000-0000-0000-0000-000000000000', batchSize: 1, expiresAt: new Date().toISOString() });
  }
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const userId = user.id;
  if (!isSupabaseVectorConfigured()) {
    return NextResponse.json({ error: 'Processamento em lotes não configurado' }, { status: 503 });
  }

  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados do PDF inválidos' }, { status: 400 });

  try {
    const access = await getUserPlanAccess(user);
    if (access.materialLimit !== null) {
      const materials = await listVectorMaterials(userId);
      if (materials.length >= access.materialLimit) {
        return NextResponse.json({ error: `O plano Grátis permite manter até ${access.materialLimit} materiais ativos. Arquive ou exclua um material, ou faça upgrade para o Pro.` }, { status: 403 });
      }
    }
    const maxOcrPages = Math.max(1, Math.min(400, Number(process.env.MAX_OCR_PAGES_PER_DOCUMENT) || 40));
    const document = await createVectorDocument({ userId, ...parsed.data, ocrPageLimit: maxOcrPages });
    const reused = document.status === 'ready';
    const ocrSummary = reused || document.processed_batches > 0 ? await getOcrDocumentSummary(document.id) : { pages: 0, confidence: null, pageNumbers: [] };
    return NextResponse.json({
      success: true,
      documentId: document.id,
      batchSize: vectorStoreMetadata.batchSize,
      expiresAt: document.expires_at,
      reused,
      ocrPages: document.status === 'ready' ? document.ocr_pages || 0 : ocrSummary.pages,
      chunkCount: reused ? await getVectorDocumentChunkCount(document.id) : 0,
      processedBatches: document.processed_batches || 0,
      maxOcrPages: document.ocr_page_limit || maxOcrPages,
      ocrLanguage: document.ocr_language || null,
      ocrConfidence: document.ocr_confidence ?? ocrSummary.confidence,
    });
  } catch (error) {
    console.error('PDF batch session failed:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível iniciar o processamento do PDF.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!isSupabaseVectorConfigured()) return NextResponse.json({ success: true });

  const documentId = new URL(request.url).searchParams.get('documentId');
  if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) {
    return NextResponse.json({ error: 'Documento inválido' }, { status: 400 });
  }
  try {
    await deleteVectorDocument(documentId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PDF batch cleanup failed:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível remover o processamento.' }, { status: 500 });
  }
}
