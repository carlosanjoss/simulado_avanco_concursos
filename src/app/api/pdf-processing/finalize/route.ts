import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { finalizeVectorDocument, getVectorDocument } from '@/lib/document-vector-store';
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const finalizeSchema = z.object({ documentId: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!isSupabaseVectorConfigured()) {
    return NextResponse.json({ error: 'Processamento em lotes não configurado' }, { status: 503 });
  }

  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Documento inválido' }, { status: 400 });

  try {
    const document = await getVectorDocument(parsed.data.documentId, userId);
    if (!document) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    const result = await finalizeVectorDocument(document);
    return NextResponse.json({ success: true, documentId: document.id, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('PDF vector finalize failed:', message);
    if (message === 'INCOMPLETE_DOCUMENT_BATCHES') {
      return NextResponse.json({ error: 'Ainda existem lotes pendentes.' }, { status: 409 });
    }
    if (message === 'EMPTY_PDF') {
      return NextResponse.json({ error: 'Não foi possível extrair texto suficiente do PDF.' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Não foi possível finalizar o processamento.' }, { status: 500 });
  }
}
