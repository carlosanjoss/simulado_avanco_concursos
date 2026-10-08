import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  var avancoSupabaseAdmin: SupabaseClient | undefined
}

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function getSupabaseVectorAuthMode(): 'secret' | 'missing' {
  if (!supabaseUrl()) return 'missing'
  if (secretKey()) return 'secret'
  return 'missing'
}

export function isSupabaseVectorConfigured(): boolean {
  return getSupabaseVectorAuthMode() !== 'missing'
}

export async function getSupabaseAdmin(): Promise<SupabaseClient> {
  const url = supabaseUrl()
  if (!url) throw new Error('SUPABASE_NOT_CONFIGURED')

  const privilegedKey = secretKey()
  if (privilegedKey) {
    if (!global.avancoSupabaseAdmin) {
      global.avancoSupabaseAdmin = createClient(url, privilegedKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    }
    return global.avancoSupabaseAdmin
  }

  throw new Error('SUPABASE_SECRET_KEY_REQUIRED')
}

export async function checkSupabaseVectorConnection(): Promise<{ ready: boolean; error?: string }> {
  if (!isSupabaseVectorConfigured()) return { ready: false, error: 'SUPABASE_NOT_CONFIGURED' }
  try {
    const client = await getSupabaseAdmin()
    const { error } = await client.from('simulado_documents').select('id').limit(1)
    if (error) return { ready: false, error: error.code || 'SUPABASE_ACCESS_DENIED' }
    return { ready: true }
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : 'SUPABASE_CONNECTION_FAILED' }
  }
}
