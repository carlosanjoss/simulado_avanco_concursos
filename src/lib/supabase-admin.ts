import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var avancoSupabaseAdmin: SupabaseClient | undefined;
}

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function publishableKey(): string | undefined {
  return process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseVectorAuthMode(): 'secret' | 'clerk' | 'missing' {
  if (!supabaseUrl()) return 'missing';
  if (secretKey()) return 'secret';
  if (publishableKey()) return 'clerk';
  return 'missing';
}

export function isSupabaseVectorConfigured(): boolean {
  return getSupabaseVectorAuthMode() !== 'missing';
}

export async function getSupabaseAdmin(): Promise<SupabaseClient> {
  const url = supabaseUrl();
  if (!url) throw new Error('SUPABASE_NOT_CONFIGURED');

  const privilegedKey = secretKey();
  if (privilegedKey) {
    if (!global.avancoSupabaseAdmin) {
      global.avancoSupabaseAdmin = createClient(url, privilegedKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return global.avancoSupabaseAdmin;
  }

  const publicKey = publishableKey();
  if (!publicKey) throw new Error('SUPABASE_NOT_CONFIGURED');
  const sessionToken = await (await auth()).getToken();
  if (!sessionToken) throw new Error('SUPABASE_CLERK_TOKEN_UNAVAILABLE');

  return createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    accessToken: async () => sessionToken,
  });
}

export async function checkSupabaseVectorConnection(): Promise<{ ready: boolean; error?: string }> {
  if (!isSupabaseVectorConfigured()) return { ready: false, error: 'SUPABASE_NOT_CONFIGURED' };
  try {
    const client = await getSupabaseAdmin();
    const { error } = await client.from('simulado_documents').select('id').limit(1);
    if (error) return { ready: false, error: error.code || 'SUPABASE_ACCESS_DENIED' };
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : 'SUPABASE_CONNECTION_FAILED' };
  }
}
