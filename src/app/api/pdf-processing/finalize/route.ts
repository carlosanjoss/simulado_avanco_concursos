import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { finalizeVectorDocument, getVectorDocument, listVectorMaterials } from '@/lib/document-vector-store';
import { isSupabaseVectorConfigured } from '@/lib/supabase-admin';
import { getUserPlanAccess } from '@/lib/plan-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const finalizeSchema = z.object({ documentId: z.string().uuid(), ocrPages: z.number().int().min(0).max(400).default(0), ocrLanguage: z.enum(['por', 'eng', 'spa', 'fra']).optional(), ocrConfidence: z.number().int().min(0).max(100).nullable().optional() }).strict();

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: true, documentId: 'build' });
  }
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const userId = user.id;
  if (!isSupabaseVectorConfigured()) {
    return NextResponse.json({ error: 'Processamento em lotes não configurado' }, { status: 503 });
  }

  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Documento inválido' }, { status: 400 });
  const access = await getUserPlanAccess(user);
  if (parsed.data.ocrPages > 0 && !access.ocr) {
    return NextResponse.json({ error: 'O processamento OCR está disponível no plano Pro.' }, { status: 403 });
  }
  const maxOcrPages = Math.max(1, Math.min(400, Number(process.env.MAX_OCR_PAGES_PER_DOCUMENT) || 40));
  if (parsed.data.ocrPages > maxOcrPages) return NextResponse.json({ error: `O limite é de ${maxOcrPages} páginas OCR por material.` }, { status: 413 });

  try {
    const document = await getVectorDocument(parsed.data.documentId, userId);
    if (!document) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    if (access.materialLimit !== null && document.status !== 'ready' && (await listVectorMaterials(userId)).length >= access.materialLimit) {
      return NextResponse.json({ error: `O plano Grátis permite até ${access.materialLimit} materiais ativos.` }, { status: 403 });
    }
    const result = await finalizeVectorDocument(document, parsed.data.ocrPages, parsed.data.ocrLanguage, parsed.data.ocrConfidence);
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
