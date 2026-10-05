import type { Question } from '@/types/quiz';

export const QUESTION_GENERATION_CONCURRENCY = 4;
export const QUESTION_GENERATION_ATTEMPTS = 3;
export const DUPLICATE_REPAIR_ATTEMPTS = 2;

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

export function questionSimilarity(first: string, second: string): number {
  const firstWords = normalizedWords(first);
  const secondWords = normalizedWords(second);
  if (firstWords.size === 0 || secondWords.size === 0) return 0;
  let intersection = 0;
  firstWords.forEach((word) => {
    if (secondWords.has(word)) intersection += 1;
  });
  return intersection / (firstWords.size + secondWords.size - intersection);
}

export function findDuplicateQuestionIds(questions: Question[], threshold = 0.72): number[] {
  const duplicates = new Set<number>();
  const ordered = [...questions].sort((a, b) => a.id - b.id);
  for (let current = 0; current < ordered.length; current += 1) {
    for (let previous = 0; previous < current; previous += 1) {
      if (questionSimilarity(ordered[current].enunciado, ordered[previous].enunciado) >= threshold) {
        duplicates.add(ordered[current].id);
        break;
      }
    }
  }
  return Array.from(duplicates).sort((a, b) => a - b);
}

function cosineSimilarity(first: number[], second: number[]): number {
  const length = Math.min(first.length, second.length);
  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += first[index] * second[index];
    firstNorm += first[index] ** 2;
    secondNorm += second[index] ** 2;
  }
  if (!firstNorm || !secondNorm) return 0;
  return dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm));
}

export function findSemanticDuplicateQuestionIds(
  questions: Question[],
  embeddings: number[][],
  threshold = 0.86,
): number[] {
  const duplicates = new Set<number>();
  const ordered = [...questions].sort((a, b) => a.id - b.id);
  if (ordered.length !== embeddings.length) throw new Error('INVALID_DUPLICATE_EMBEDDINGS');
  for (let current = 0; current < ordered.length; current += 1) {
    for (let previous = 0; previous < current; previous += 1) {
      if (cosineSimilarity(embeddings[current], embeddings[previous]) >= threshold) {
        duplicates.add(ordered[current].id);
        break;
      }
    }
  }
  return Array.from(duplicates).sort((a, b) => a - b);
}

export function getQuestionQualityIssues(
  question: Question,
  domain: 'mathematics' | 'general',
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

  if (domain === 'mathematics') {
    const numericOptions = question.opcoes.filter((option) => /\d/.test(option)).length;
    const hasCalculationEvidence = /(?:\d\s*[+\-×÷*/=<>^]\s*\d|\b(c[aá]lculo|resultado|substituindo|logo|portanto|f[oó]rmula)\b)/i
      .test(question.justificativa);
    if (numericOptions >= 2 && !hasCalculationEvidence) {
      issues.push('justificativa matemática sem cálculo verificável');
    }
  }
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
