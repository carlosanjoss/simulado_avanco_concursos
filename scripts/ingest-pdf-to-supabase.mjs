import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { env as transformersEnv, pipeline } from '@huggingface/transformers';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const PAGE_BATCH_SIZE = 5;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const EMBEDDING_BATCH_SIZE = 16;

function parseEnv(source) {
  return source.split(/\r?\n/).reduce((result, line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return result;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    return result;
  }, {});
}

function chunkText(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const sentenceEnd = normalized.lastIndexOf('. ', end);
      if (sentenceEnd > start + CHUNK_SIZE / 2) end = sentenceEnd + 1;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

async function main() {
  const pdfPath = process.argv[2];
  const email = process.argv[3] || 'carlosdeemelo@gmail.com';
  if (!pdfPath) throw new Error('Uso: node scripts/ingest-pdf-to-supabase.mjs <arquivo.pdf> [email]');

  const localEnv = parseEnv(await readFile('.env.local', 'utf8'));
  const supabaseUrl = localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = localEnv.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) throw new Error('Credenciais Supabase ausentes.');

  const prisma = new PrismaClient({
    datasourceUrl: `file:${path.join(process.cwd(), 'prisma', 'dev.db').replaceAll('\\', '/')}`,
  });
  const user = await prisma.user.findFirst({ where: { email }, select: { clerkId: true } });
  await prisma.$disconnect();
  if (!user) throw new Error(`Usuário local não encontrado para ${email}.`);

  const file = await readFile(path.resolve(pdfPath));
  if (file.length > 20 * 1024 * 1024) throw new Error('PDF acima de 20 MB.');
  const fileHash = createHash('sha256').update(file).digest('hex');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(file) });
  const document = await loadingTask.promise;
  if (document.numPages > 400) throw new Error('PDF acima de 400 páginas.');
  const totalBatches = Math.ceil(document.numPages / PAGE_BATCH_SIZE);

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const lookup = await supabase.from('simulado_documents').select('*')
    .eq('user_id', user.clerkId).eq('file_hash', fileHash).gt('expires_at', now)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (lookup.error) throw lookup.error;

  let storedDocument = lookup.data;
  if (!storedDocument) {
    const created = await supabase.from('simulado_documents').insert({
      user_id: user.clerkId,
      file_name: path.basename(pdfPath),
      file_hash: fileHash,
      file_size: file.length,
      total_pages: document.numPages,
      total_batches: totalBatches,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select('*').single();
    if (created.error) throw created.error;
    storedDocument = created.data;
  }

  transformersEnv.cacheDir = path.join(process.cwd(), '.cache', 'transformers');
  transformersEnv.allowRemoteModels = true;
  transformersEnv.useFSCache = true;
  const embedder = await pipeline('feature-extraction', localEnv.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2', {
    device: 'cpu',
    dtype: 'q8',
  });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const existing = await supabase.from('simulado_batches').select('status')
      .eq('document_id', storedDocument.id).eq('batch_index', batchIndex).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.status === 'complete') {
      process.stdout.write(`Lote ${batchIndex + 1}/${totalBatches}: já processado\n`);
      continue;
    }

    const pageStart = batchIndex * PAGE_BATCH_SIZE + 1;
    const pageEnd = Math.min(document.numPages, pageStart + PAGE_BATCH_SIZE - 1);
    const chunks = [];
    for (let pageNumber = pageStart; pageNumber <= pageEnd; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      for (const value of chunkText(text)) {
        chunks.push({ pageNumber, value });
      }
      page.cleanup();
    }

    const embeddings = [];
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const output = await embedder(chunks.slice(start, start + EMBEDDING_BATCH_SIZE).map((chunk) => chunk.value), {
        pooling: 'mean', normalize: true,
      });
      embeddings.push(...output.tolist());
    }
    const rows = chunks.map((chunk, chunkIndex) => ({
      document_id: storedDocument.id,
      user_id: user.clerkId,
      batch_index: batchIndex,
      chunk_index: chunkIndex,
      page_number: chunk.pageNumber,
      text_content: chunk.value,
      content_hash: createHash('sha256').update(`${chunk.pageNumber}:${chunk.value}`).digest('hex'),
      embedding: embeddings[chunkIndex],
    }));
    if (rows.length) {
      const inserted = await supabase.from('simulado_chunks').upsert(rows, {
        onConflict: 'document_id,batch_index,chunk_index',
      });
      if (inserted.error) throw inserted.error;
    }
    const batch = await supabase.from('simulado_batches').upsert({
      document_id: storedDocument.id,
      batch_index: batchIndex,
      page_start: pageStart,
      page_end: pageEnd,
      chunk_count: rows.length,
      status: 'complete',
      completed_at: new Date().toISOString(),
    }, { onConflict: 'document_id,batch_index' });
    if (batch.error) throw batch.error;
    const updated = await supabase.from('simulado_documents').update({
      status: 'processing', processed_batches: batchIndex + 1, updated_at: new Date().toISOString(),
    }).eq('id', storedDocument.id);
    if (updated.error) throw updated.error;
    process.stdout.write(`Lote ${batchIndex + 1}/${totalBatches}: ${rows.length} chunks enviados\n`);
  }

  const chunksResult = await supabase.from('simulado_chunks')
    .select('*', { count: 'exact', head: true }).eq('document_id', storedDocument.id);
  if (chunksResult.error) throw chunksResult.error;
  const finalized = await supabase.from('simulado_documents').update({
    status: 'ready', processed_batches: totalBatches, updated_at: new Date().toISOString(),
  }).eq('id', storedDocument.id);
  if (finalized.error) throw finalized.error;

  const queryOutput = await embedder(['conceitos principais e aplicações práticas'], { pooling: 'mean', normalize: true });
  const rpc = await supabase.rpc('match_simulado_chunks', {
    query_embedding: queryOutput.tolist()[0],
    match_threshold: -1,
    match_count: 3,
    p_document_id: storedDocument.id,
    p_user_id: user.clerkId,
    p_page_from: 1,
    p_page_to: document.numPages,
  });
  if (rpc.error) throw rpc.error;
  await loadingTask.destroy();
  process.stdout.write(`${JSON.stringify({
    success: true,
    documentId: storedDocument.id,
    pages: document.numPages,
    batches: totalBatches,
    chunks: chunksResult.count,
    retrievalResults: rpc.data?.length ?? 0,
  })}\n`);
}

await main();
