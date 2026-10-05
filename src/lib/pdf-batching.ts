import { createHash } from 'node:crypto';
import { chunkPdfText } from '@/lib/embeddings';

export const PDF_PAGE_BATCH_SIZE = 5;
export const MAX_BATCH_TEXT_LENGTH = 500_000;
export const MAX_CHUNKS_PER_BATCH = 150;

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface PageChunk {
  chunk_index: number;
  page_number: number;
  text_content: string;
  content_hash: string;
}

export function getQuestionPageWindow(questionIndex: number, totalPages: number, questionCount = 30) {
  const safeTotal = Math.max(1, totalPages);
  const from = Math.floor((questionIndex * safeTotal) / questionCount) + 1;
  const to = Math.max(from, Math.floor(((questionIndex + 1) * safeTotal) / questionCount));
  return { from: Math.min(from, safeTotal), to: Math.min(to, safeTotal) };
}

export function buildPageChunks(pages: PdfPageText[]): PageChunk[] {
  const chunks: PageChunk[] = [];
  pages.forEach((page) => {
    chunkPdfText(page.text).forEach((content) => {
      chunks.push({
        chunk_index: chunks.length,
        page_number: page.pageNumber,
        text_content: content,
        content_hash: createHash('sha256').update(`${page.pageNumber}:${content}`).digest('hex'),
      });
    });
  });
  return chunks;
}
