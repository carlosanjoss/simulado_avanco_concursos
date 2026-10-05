import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractTextFromPDF } from '../src/lib/pdf-utils';
import { chunkPdfText } from '../src/lib/embeddings';

const PDF_PAGE_BATCH_SIZE = 5;

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Uso: npx vite-node scripts/audit-pdf-ingestion.ts <arquivo.pdf>');

  const buffer = await readFile(path.resolve(inputPath));
  const extracted = await extractTextFromPDF(buffer);
  const chunks = extracted.pages.flatMap((page) =>
    chunkPdfText(page.text).map((text) => ({ page_number: page.pageNumber, text })),
  );
  const pagesWithText = extracted.pages.filter((page) => page.text.trim().length > 0).length;
  const pageNumbers = new Set(chunks.map((chunk) => chunk.page_number));

  process.stdout.write(`${JSON.stringify({
    fileBytes: buffer.length,
    pages: extracted.pageCount,
    pagesWithText,
    characters: extracted.text.length,
    batches: Math.ceil(extracted.pageCount / PDF_PAGE_BATCH_SIZE),
    chunks: chunks.length,
    pagesRepresentedByChunks: pageNumbers.size,
  }, null, 2)}\n`);
}

void main();
