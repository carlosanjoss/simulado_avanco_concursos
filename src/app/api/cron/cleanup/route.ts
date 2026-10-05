import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseAdmin();
    const { data, error } = await supabase.rpc('delete_expired_simulado_documents');
    if (error) throw error;
    return NextResponse.json({ success: true, deletedDocuments: data ?? 0 });
  } catch (error) {
    console.error('Falha ao limpar documentos expirados:', error);
    return NextResponse.json({ success: false, error: 'Falha na limpeza' }, { status: 500 });
  }
}
