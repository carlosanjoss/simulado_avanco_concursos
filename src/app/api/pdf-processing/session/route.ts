import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createVectorDocument,
  deleteVectorDocument,
  PDF_PAGE_BATCH_SIZE,
  vectorStoreMetadata,
} from '@/lib/document-vector-store';
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!isSupabaseVectorConfigured()) {
    return NextResponse.json({ error: 'Processamento em lotes não configurado' }, { status: 503 });
  }

  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados do PDF inválidos' }, { status: 400 });

  try {
    const document = await createVectorDocument({ userId, ...parsed.data });
    return NextResponse.json({
      success: true,
      documentId: document.id,
      batchSize: vectorStoreMetadata.batchSize,
      expiresAt: document.expires_at,
    });
  } catch (error) {
    console.error('PDF batch session failed:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível iniciar o processamento do PDF.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
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
