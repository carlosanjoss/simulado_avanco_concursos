import { describe, expect, it } from 'vitest';
import { chunkPdfText, MAX_EMBEDDING_CHUNKS } from '@/lib/embeddings';

describe('PDF chunking', () => {
  it('creates overlapping chunks without requiring the model download', () => {
    const text = Array.from({ length: 500 }, (_, index) => `Frase ${index} com conteúdo do documento.`).join(' ');
    const chunks = chunkPdfText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(MAX_EMBEDDING_CHUNKS);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
  });

  it('keeps coverage through the end of very long documents', () => {
    const text = `${'conteudo extenso da pagina. '.repeat(70_000)} FIM_DOCUMENTO`;
    const chunks = chunkPdfText(text);
    expect(chunks).toHaveLength(MAX_EMBEDDING_CHUNKS);
    expect(chunks.at(-1)).toContain('FIM_DOCUMENTO');
  });
});
