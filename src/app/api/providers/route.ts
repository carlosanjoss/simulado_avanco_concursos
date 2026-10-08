import { NextRequest, NextResponse } from 'next/server'
import { getProviderConfiguration } from '@/lib/ai-providers'
import { checkSupabaseVectorConnection, getSupabaseVectorAuthMode } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!await getAuthenticatedUser(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const providers = getProviderConfiguration()
  const vectorConnection = await checkSupabaseVectorConnection()
  return NextResponse.json({
    strategy: 'openrouter',
    pdfBatchProcessing: vectorConnection.ready,
    pdfBatchProcessingError: vectorConnection.ready ? undefined : 'VECTOR_SERVICE_UNAVAILABLE',
    vectorAuthMode: getSupabaseVectorAuthMode() === 'missing' ? 'missing' : 'configured',
    providers: providers.map((provider) => ({
      ...provider,
      available: provider.configured,
    })),
  })
}
