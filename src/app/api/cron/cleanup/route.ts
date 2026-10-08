import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Skip during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: true, deletedDocuments: 0 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseAdmin();
    const { data, error } = await supabase.rpc('delete_expired_simulado_documents');
    if (error) throw error;
    const deletedTokens = await prisma.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }] } });
    return NextResponse.json({ success: true, deletedDocuments: data ?? 0, deletedTokens: deletedTokens.count });
  } catch (error) {
    console.error('Falha ao limpar documentos expirados:', error);
    return NextResponse.json({ success: false, error: 'Falha na limpeza' }, { status: 500 });
  }
}
