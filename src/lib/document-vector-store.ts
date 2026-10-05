import 'server-only';
import { embedTexts, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/lib/embeddings';
import { mapWithConcurrency } from '@/lib/question-generation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildPageChunks,
  getQuestionPageWindow,
  MAX_CHUNKS_PER_BATCH,
  PDF_PAGE_BATCH_SIZE,
  type PdfPageText,
} from '@/lib/pdf-batching';
import type { QuestionSource } from '@/types/quiz';

export { MAX_BATCH_TEXT_LENGTH, MAX_CHUNKS_PER_BATCH, PDF_PAGE_BATCH_SIZE } from '@/lib/pdf-batching';

const CONTEXT_CHUNKS_PER_QUESTION = 8;
const CONTEXT_CANDIDATES_PER_QUESTION = 20;
const CONTEXT_QUERY_CONCURRENCY = 4;

const RETRIEVAL_OBJECTIVES = [
  'definições, conceitos centrais e terminologia técnica',
  'relações de causa e efeito e consequências práticas',
  'etapas, procedimentos, métodos e ordem de execução',
  'comparações, diferenças, classificações e categorias',
  'regras, requisitos, condições, limites e exceções',
  'aplicações, exemplos, casos concretos e resolução de problemas',
  'dados, fórmulas, cálculos, grandezas e relações quantitativas',
  'argumentos, conclusões e implicações do conteúdo',
] as const;

export interface VectorDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_hash: string;
  file_size: number;
  total_pages: number;
  total_batches: number;
  processed_batches: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  expires_at: string;
}

export interface RetrievedQuestionContext {
  text: string;
  sources: QuestionSource[];
  pageWindow: { from: number; to: number };
  objective: string;
  domain: 'mathematics' | 'general';
}

interface StoredChunk {
  document_id: string;
  user_id: string;
  batch_index: number;
  chunk_index: number;
  page_number: number;
  text_content: string;
  content_hash: string;
  embedding: number[];
}

interface MatchedChunk {
  id: number | string;
  page_number: number;
  text_content: string;
  similarity: number;
}

function assertSupabaseResult(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}

function looksMathematical(text: string): boolean {
  const terms = text.match(/\b(equa[cç][aã]o|teorema|fun[cç][aã]o|matriz|vetor|derivada|integral|probabilidade|estat[ií]stica|geometria|[aá]lgebra|fra[cç][aã]o|porcentagem|m[eé]dia|mediana|vari[aá]vel|logaritmo|seno|cosseno|hipotenusa|algoritmo|complexidade)\b/gi)?.length ?? 0;
  const expressions = text.match(/(?:\d\s*[+\-×÷*/=<>^]\s*\d|[A-Za-z]\s*=\s*[^\s,.]{1,20})/g)?.length ?? 0;
  return terms >= 2 || expressions >= 3;
}

function selectPageDiverseMatches(matches: MatchedChunk[]): MatchedChunk[] {
  const ranked = [...matches].sort((a, b) => b.similarity - a.similarity);
  const selected: MatchedChunk[] = [];
  const selectedPages = new Set<number>();

  for (const match of ranked) {
    if (selectedPages.has(match.page_number)) continue;
    selected.push(match);
    selectedPages.add(match.page_number);
    if (selected.length === CONTEXT_CHUNKS_PER_QUESTION) return selected;
  }
  for (const match of ranked) {
    if (selected.some((item) => String(item.id) === String(match.id))) continue;
    selected.push(match);
    if (selected.length === CONTEXT_CHUNKS_PER_QUESTION) break;
  }
  return selected;
}

function toSource(match: MatchedChunk): QuestionSource {
  return {
    chunkId: String(match.id),
    pageNumber: match.page_number,
    excerpt: match.text_content.slice(0, 600),
    similarity: Math.round(match.similarity * 10_000) / 10_000,
  };
}

export async function createVectorDocument(input: {
  userId: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  totalPages: number;
  totalBatches: number;
}): Promise<VectorDocument> {
  const supabase = await getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('simulado_documents')
    .select('*')
    .eq('user_id', input.userId)
    .eq('file_hash', input.fileHash)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  assertSupabaseResult(existingError, 'VECTOR_DOCUMENT_LOOKUP_FAILED');
  if (existing && existing.total_pages === input.totalPages && existing.total_batches === input.totalBatches) {
    return existing as VectorDocument;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('simulado_documents')
    .insert({
      user_id: input.userId,
      file_name: input.fileName,
      file_hash: input.fileHash,
      file_size: input.fileSize,
      total_pages: input.totalPages,
      total_batches: input.totalBatches,
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  assertSupabaseResult(error, 'VECTOR_DOCUMENT_CREATE_FAILED');
  return data as VectorDocument;
}

export async function getVectorDocument(documentId: string, userId: string): Promise<VectorDocument | null> {
  const { data, error } = await (await getSupabaseAdmin())
    .from('simulado_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle();
  assertSupabaseResult(error, 'VECTOR_DOCUMENT_READ_FAILED');
  return data as VectorDocument | null;
}

export async function getVectorDocumentChunkCount(documentId: string): Promise<number> {
  const { count, error } = await (await getSupabaseAdmin())
    .from('simulado_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);
  assertSupabaseResult(error, 'VECTOR_CHUNK_COUNT_FAILED');
  return count ?? 0;
}

export async function processVectorBatch(input: {
  document: VectorDocument;
  batchIndex: number;
  pages: PdfPageText[];
}): Promise<{ chunks: number; alreadyProcessed: boolean }> {
  const supabase = await getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('simulado_batches')
    .select('status')
    .eq('document_id', input.document.id)
    .eq('batch_index', input.batchIndex)
    .maybeSingle();
  assertSupabaseResult(existingError, 'VECTOR_BATCH_READ_FAILED');
  if (existing?.status === 'complete') return { chunks: 0, alreadyProcessed: true };

  const chunks = buildPageChunks(input.pages);
  if (chunks.length > MAX_CHUNKS_PER_BATCH) throw new Error('BATCH_TOO_DENSE');

  const embeddings = chunks.length ? await embedTexts(chunks.map((chunk) => chunk.text_content)) : [];
  if (embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error('INVALID_EMBEDDING_DIMENSIONS');
  }

  const rows: StoredChunk[] = chunks.map((chunk, index) => ({
    ...chunk,
    document_id: input.document.id,
    user_id: input.document.user_id,
    batch_index: input.batchIndex,
    embedding: embeddings[index],
  }));
  if (rows.length > 0) {
    const { error: chunksError } = await supabase
      .from('simulado_chunks')
      .upsert(rows, { onConflict: 'document_id,batch_index,chunk_index' });
    assertSupabaseResult(chunksError, 'VECTOR_CHUNKS_STORE_FAILED');
  }

  const pageNumbers = input.pages.map((page) => page.pageNumber);
  const { error: batchError } = await supabase.from('simulado_batches').upsert({
    document_id: input.document.id,
    batch_index: input.batchIndex,
    page_start: Math.min(...pageNumbers),
    page_end: Math.max(...pageNumbers),
    chunk_count: rows.length,
    status: 'complete',
    completed_at: new Date().toISOString(),
  }, { onConflict: 'document_id,batch_index' });
  assertSupabaseResult(batchError, 'VECTOR_BATCH_STORE_FAILED');

  const { count, error: countError } = await supabase
    .from('simulado_batches')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', input.document.id)
    .eq('status', 'complete');
  assertSupabaseResult(countError, 'VECTOR_BATCH_COUNT_FAILED');
  const { error: updateError } = await supabase
    .from('simulado_documents')
    .update({ status: 'processing', processed_batches: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', input.document.id)
    .eq('user_id', input.document.user_id);
  assertSupabaseResult(updateError, 'VECTOR_DOCUMENT_UPDATE_FAILED');

  return { chunks: rows.length, alreadyProcessed: false };
}

export async function finalizeVectorDocument(document: VectorDocument): Promise<{ chunkCount: number }> {
  const supabase = await getSupabaseAdmin();
  const { count: batchCount, error: batchError } = await supabase
    .from('simulado_batches')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', document.id)
    .eq('status', 'complete');
  assertSupabaseResult(batchError, 'VECTOR_BATCH_COUNT_FAILED');
  if (batchCount !== document.total_batches) throw new Error('INCOMPLETE_DOCUMENT_BATCHES');

  const { count: chunkCount, error: chunkError } = await supabase
    .from('simulado_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', document.id);
  assertSupabaseResult(chunkError, 'VECTOR_CHUNK_COUNT_FAILED');
  if (!chunkCount) throw new Error('EMPTY_PDF');

  const { error: updateError } = await supabase
    .from('simulado_documents')
    .update({ status: 'ready', processed_batches: batchCount, updated_at: new Date().toISOString() })
    .eq('id', document.id)
    .eq('user_id', document.user_id);
  assertSupabaseResult(updateError, 'VECTOR_DOCUMENT_FINALIZE_FAILED');
  return { chunkCount };
}

export async function getDocumentQuestionContexts(
  document: VectorDocument,
  focus?: string,
): Promise<Map<number, RetrievedQuestionContext>> {
  if (document.status !== 'ready') throw new Error('VECTOR_DOCUMENT_NOT_READY');

  const focusItems = focus?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  const plans = Array.from({ length: 30 }, (_, index) => {
    const pageWindow = getQuestionPageWindow(index, document.total_pages);
    const objective = RETRIEVAL_OBJECTIVES[index % RETRIEVAL_OBJECTIVES.length];
    const focusItem = focusItems.length ? focusItems[index % focusItems.length] : '';
    const query = [focusItem, objective, 'conteúdo específico e verificável para elaborar uma questão'].filter(Boolean).join('; ');
    return { pageWindow, objective, query };
  });
  const queryEmbeddings = await embedTexts(plans.map((plan) => plan.query));
  const contexts = new Map<number, RetrievedQuestionContext>();
  const supabase = await getSupabaseAdmin();

  await mapWithConcurrency(plans.map((_, index) => index), CONTEXT_QUERY_CONCURRENCY, async (index) => {
    const plan = plans[index];
    const primary = await supabase.rpc('match_simulado_chunks', {
      query_embedding: queryEmbeddings[index],
      match_threshold: -1,
      match_count: CONTEXT_CANDIDATES_PER_QUESTION,
      p_document_id: document.id,
      p_user_id: document.user_id,
      p_page_from: plan.pageWindow.from,
      p_page_to: plan.pageWindow.to,
    });
    assertSupabaseResult(primary.error, 'VECTOR_SEARCH_FAILED');
    let matches = (primary.data || []) as MatchedChunk[];

    if (matches.length < CONTEXT_CHUNKS_PER_QUESTION) {
      const expandedFrom = Math.max(1, plan.pageWindow.from - 3);
      const expandedTo = Math.min(document.total_pages, plan.pageWindow.to + 3);
      const expanded = await supabase.rpc('match_simulado_chunks', {
        query_embedding: queryEmbeddings[index],
        match_threshold: -1,
        match_count: CONTEXT_CANDIDATES_PER_QUESTION,
        p_document_id: document.id,
        p_user_id: document.user_id,
        p_page_from: expandedFrom,
        p_page_to: expandedTo,
      });
      assertSupabaseResult(expanded.error, 'VECTOR_SEARCH_FAILED');
      matches = Array.from(new Map(
        [...matches, ...((expanded.data || []) as MatchedChunk[])].map((item) => [String(item.id), item]),
      ).values());
    }

    const selected = selectPageDiverseMatches(matches);
    if (selected.length === 0) throw new Error(`VECTOR_CONTEXT_EMPTY:${index + 1}`);
    const ordered = [...selected].sort((a, b) => a.page_number - b.page_number || b.similarity - a.similarity);
    const text = ordered
      .map((match) => `[Fonte chunk ${match.id} | Página ${match.page_number} | Similaridade ${match.similarity.toFixed(3)}]\n${match.text_content}`)
      .join('\n\n');
    contexts.set(index + 1, {
      text,
      sources: ordered.map(toSource),
      pageWindow: plan.pageWindow,
      objective: plan.objective,
      domain: looksMathematical(text) ? 'mathematics' : 'general',
    });
  });

  return contexts;
}

export async function deleteVectorDocument(documentId: string, userId: string): Promise<void> {
  const { error } = await (await getSupabaseAdmin())
    .from('simulado_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', userId);
  assertSupabaseResult(error, 'VECTOR_DOCUMENT_DELETE_FAILED');
}

export const vectorStoreMetadata = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  batchSize: PDF_PAGE_BATCH_SIZE,
  chunksPerQuestion: CONTEXT_CHUNKS_PER_QUESTION,
};
