import path from 'node:path';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
export const MAX_EMBEDDING_CHUNKS = 1_600;
const BATCH_SIZE = 16;
const MAX_CONTEXT_LENGTH = 32_000;

export interface VectorizedChunk {
  index: number;
  content: string;
  embedding: number[];
}

export interface VectorizedPdf {
  chunks: VectorizedChunk[];
  contextText: string;
  model: string;
  dimensions: number;
}

declare global {
  // eslint-disable-next-line no-var
  var miniLmExtractorPromise: Promise<FeatureExtractionPipeline> | undefined;
}

env.cacheDir = process.env.VERCEL
  ? path.join('/tmp', 'avanco-transformers')
  : path.join(process.cwd(), '.cache', 'transformers');
env.allowRemoteModels = true;
env.useFSCache = true;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!global.miniLmExtractorPromise) {
    const createFeatureExtractor = pipeline as unknown as (
      task: 'feature-extraction',
      model: string,
      options: { device: 'cpu'; dtype: 'q8' }
    ) => Promise<FeatureExtractionPipeline>;

    global.miniLmExtractorPromise = createFeatureExtractor(
      'feature-extraction',
      EMBEDDING_MODEL,
      {
        device: 'cpu',
        dtype: 'q8',
      }
    );
  }

  return global.miniLmExtractorPromise;
}

export function chunkPdfText(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      const lastSentence = normalized.lastIndexOf('. ', end);
      if (lastSentence > start + CHUNK_SIZE / 2) {
        end = lastSentence + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  if (chunks.length <= MAX_EMBEDDING_CHUNKS) return chunks;

  // Preserve coverage from the first through the last page instead of silently
  // discarding the end of long documents.
  return Array.from({ length: MAX_EMBEDDING_CHUNKS }, (_, index) =>
    chunks[Math.floor((index * (chunks.length - 1)) / (MAX_EMBEDDING_CHUNKS - 1))]
  );
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE);
    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });
    embeddings.push(...(output.tolist() as number[][]));
  }

  return embeddings;
}

function dotProduct(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += a[index] * b[index];
  }
  return total;
}

function buildContext(
  chunks: VectorizedChunk[],
  queryEmbedding: number[]
): string {
  const fullText = chunks.map((chunk) => chunk.content).join('\n\n');
  if (fullText.length <= MAX_CONTEXT_LENGTH) return fullText;

  const ranked = chunks
    .map((chunk) => ({
      ...chunk,
      similarity: dotProduct(chunk.embedding, queryEmbedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 12);
  const diverse = Array.from({ length: Math.min(6, chunks.length) }, (_, index) =>
    chunks[Math.floor((index * (chunks.length - 1)) / Math.max(1, Math.min(6, chunks.length) - 1))]
  );
  const selected = Array.from(new Map([...ranked, ...diverse].map((chunk) => [chunk.index, chunk])).values())
    .sort((a, b) => a.index - b.index);

  return selected
    .map((chunk) => chunk.content)
    .join('\n\n')
    .slice(0, MAX_CONTEXT_LENGTH);
}

export async function vectorizePdfText(
  text: string,
  focus?: string | null
): Promise<VectorizedPdf> {
  const contents = chunkPdfText(text);
  if (contents.length === 0) {
    throw new Error('Não foi possível criar trechos para vetorização do PDF');
  }

  const embeddings = await embedTexts(contents);
  const query = focus?.trim() || 'principais conceitos, fatos e argumentos do documento';
  const [queryEmbedding] = await embedTexts([query]);

  const chunks = contents.map((content, index) => ({
    index,
    content,
    embedding: embeddings[index],
  }));

  return {
    chunks,
    contextText: buildContext(chunks, queryEmbedding),
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}
