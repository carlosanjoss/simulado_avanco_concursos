import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const source = await readFile('.env.local', 'utf8');
const getLastValue = (name) => {
  const matches = [...source.matchAll(new RegExp(`^${name}=(.*)$`, 'gm'))];
  return matches.at(-1)?.[1].trim().replace(/^["']|["']$/g, '');
};

const url = getLastValue('SUPABASE_URL') || getLastValue('NEXT_PUBLIC_SUPABASE_URL');
const key = getLastValue('SUPABASE_SECRET_KEY') || getLastValue('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) throw new Error('Supabase não configurado.');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tableResults = await Promise.all(
  ['simulado_documents', 'simulado_batches', 'simulado_chunks'].map(async (table) => {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
    return { table, ready: !error, rows: count ?? null, errorCode: error?.code };
  }),
);
const latest = await client.from('simulado_documents')
  .select('id,file_name,total_pages,total_batches,processed_batches,status')
  .order('created_at', { ascending: false }).limit(1).maybeSingle();
let latestDocument = null;
if (latest.data) {
  const chunkPageResults = await Promise.all([0, 1000].map((from) =>
    client.from('simulado_chunks').select('page_number')
      .eq('document_id', latest.data.id).range(from, from + 999),
  ));
  const chunkPageError = chunkPageResults.find((result) => result.error)?.error;
  const chunkPages = chunkPageResults.flatMap((result) => result.data ?? []);
  latestDocument = {
    ...latest.data,
    pagesRepresented: chunkPageError
      ? null
      : new Set(chunkPages.map((row) => row.page_number)).size,
  };
}
const zeroVector = Array.from({ length: 384 }, () => 0);
const rpc = await client.rpc('match_simulado_chunks', {
  query_embedding: zeroVector,
  match_threshold: -1,
  match_count: 1,
  p_document_id: '00000000-0000-0000-0000-000000000000',
  p_user_id: '__connection_check__',
  p_page_from: null,
  p_page_to: null,
});

process.stdout.write(`${JSON.stringify({
  ready: tableResults.every((result) => result.ready) && !rpc.error,
  tables: tableResults,
  latestDocument,
  rpcReady: !rpc.error,
  rpcErrorCode: rpc.error?.code,
})}\n`);
