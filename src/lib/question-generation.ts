import type { Question } from '@/types/quiz';
import { createHash } from 'node:crypto';

export const QUESTION_GENERATION_CONCURRENCY = 4;
export const QUESTION_GENERATION_ATTEMPTS = 3;
export const DUPLICATE_REPAIR_ATTEMPTS = 3;

function normalizedWords(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function contentHash(text: string): string {
  return createHash('sha256')
    .update(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ''))
    .digest('hex');
}

function questionSimilarity(first: string, second: string): number {
  const firstWords = normalizedWords(first);
  const secondWords = normalizedWords(second);
  if (firstWords.size === 0 || secondWords.size === 0) return 0;
  let intersection = 0;
  firstWords.forEach((word) => {
    if (secondWords.has(word)) intersection += 1;
  });
  return intersection / (firstWords.size + secondWords.size - intersection);
}

export function findDuplicateQuestionIds(questions: Question[], threshold = 0.55): number[] {
  const duplicates = new Set<number>();
  const ordered = [...questions].sort((a, b) => a.id - b.id);

  // Primeiro: hash exato de conteúdo normalizado
  const contentHashes = new Map<string, number>();
  for (const question of ordered) {
    const hash = contentHash(question.enunciado);
    if (contentHashes.has(hash)) {
      duplicates.add(question.id);
    } else {
      contentHashes.set(hash, question.id);
    }
  }

  // Segundo: similaridade textual (Jaccard) - mais agressivo
  for (let current = 0; current < ordered.length; current += 1) {
    if (duplicates.has(ordered[current].id)) continue;
    for (let previous = 0; previous < current; previous += 1) {
      if (duplicates.has(ordered[previous].id)) continue;
      if (questionSimilarity(ordered[current].enunciado, ordered[previous].enunciado) >= threshold) {
        duplicates.add(ordered[current].id);
        break;
      }
    }
  }

  return Array.from(duplicates).sort((a, b) => a - b);
}

export function getQuestionQualityIssues(
  question: Question,
): string[] {
  const issues: string[] = [];
  const normalizedOptions = question.opcoes.map((option) => option
    .replace(/^[A-D]\)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR'));
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    issues.push('alternativas duplicadas');
  }
  const correctOption = question.opcoes.find((option) => option.startsWith(`${question.resposta_correta})`));
  if (!correctOption) issues.push('alternativa correta ausente');
  return issues;
}

export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    }),
  );
}
