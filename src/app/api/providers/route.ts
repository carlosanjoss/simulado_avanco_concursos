import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProviderConfiguration } from '@/lib/ai-providers';
import { checkSupabaseVectorConnection, getSupabaseVectorAuthMode } from '@/lib/supabase-admin';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const providers = getProviderConfiguration();
  const vectorConnection = await checkSupabaseVectorConnection();
  return NextResponse.json({
    strategy: 'openrouter',
    pdfBatchProcessing: vectorConnection.ready,
    pdfBatchProcessingError: vectorConnection.error,
    vectorAuthMode: getSupabaseVectorAuthMode(),
    providers: providers.map((provider) => ({
      ...provider,
      available: provider.configured,
    })),
  });
}
