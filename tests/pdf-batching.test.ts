import { describe, expect, it } from 'vitest';
import { buildPageChunks, getQuestionPageWindow } from '@/lib/pdf-batching';

describe('PDF page batching', () => {
  it('preserves page numbers while creating overlapping chunks', () => {
    const chunks = buildPageChunks([
      { pageNumber: 12, text: 'Conteúdo técnico da página doze. '.repeat(80) },
      { pageNumber: 13, text: 'Conteúdo técnico da página treze. '.repeat(80) },
    ]);
    expect(chunks.length).toBeGreaterThan(2);
    expect(new Set(chunks.map((chunk) => chunk.page_number))).toEqual(new Set([12, 13]));
    expect(chunks.every((chunk, index) => chunk.chunk_index === index)).toBe(true);
    expect(chunks.every((chunk) => chunk.content_hash.length === 64)).toBe(true);
  });

  it('distributes thirty question contexts across all 400 pages', () => {
    const windows = Array.from({ length: 30 }, (_, index) => getQuestionPageWindow(index, 400));
    expect(windows[0]).toEqual({ from: 1, to: 13 });
    expect(windows.at(-1)).toEqual({ from: 387, to: 400 });
    expect(windows.every((window, index) => index === 0 || window.from === windows[index - 1].to + 1)).toBe(true);
  });
});
