import type { Question } from '@/types/quiz';
import { createHash } from 'node:crypto';

export const QUESTION_GENERATION_CONCURRENCY = 4;
export const QUESTION_GENERATION_ATTEMPTS = 3;
// Uma única correção paga é permitida se a prevenção local ainda deixar passar
// uma duplicata. Evita ciclos de regeneração que aumentam o custo sem garantia.
export const DUPLICATE_REPAIR_ATTEMPTS = 1;

export const DUPLICATE_BIGRAM_THRESHOLD = 0.72;
export const DUPLICATE_CONTAINMENT_THRESHOLD = 0.82;
export const DUPLICATE_OPTIONS_THRESHOLD = 0.75;

const PORTUGUESE_STOP_WORDS = new Set([
  'ainda', 'alem', 'algum', 'alguma', 'algumas', 'alguns', 'assim', 'cada', 'como',
  'com', 'contra', 'daquele', 'deste', 'disso', 'documento', 'entre', 'essa', 'esse',
  'esta', 'este', 'isso', 'mais', 'mesma', 'mesmo', 'nessa', 'neste', 'para', 'pela',
  'pelo', 'qual', 'quando', 'quanto', 'segundo', 'sobre', 'texto', 'uma', 'voce',
]);

function normalizedTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !PORTUGUESE_STOP_WORDS.has(word));
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizedTokens(text));
}

function containmentSimilarity(first: string, second: string): number {
  const firstWords = tokenSet(first);
  const secondWords = tokenSet(second);
  const denominator = Math.min(firstWords.size, secondWords.size);
  if (denominator === 0) return 0;
  let intersection = 0;
  firstWords.forEach((word) => {
    if (secondWords.has(word)) intersection += 1;
  });
  return intersection / denominator;
}

function wordBigrams(text: string): Set<string> {
  const tokens = normalizedTokens(text);
  return new Set(tokens.slice(0, -1).map((token, index) => `${token}:${tokens[index + 1]}`));
}

function diceBigramSimilarity(first: string, second: string): number {
  const ngrams1 = wordBigrams(first);
  const ngrams2 = wordBigrams(second);
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
  let intersection = 0;
  ngrams1.forEach(ng => { if (ngrams2.has(ng)) intersection++; });
  return (2 * intersection) / (ngrams1.size + ngrams2.size);
}

// Novo: options overlap similarity
function optionsOverlapSimilarity(opcoes1: string[], opcoes2: string[]): number {
  const norm1 = opcoes1.map(o => o.replace(/^[A-E]\)\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase());
  const norm2 = opcoes2.map(o => o.replace(/^[A-E]\)\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase());
  
  let intersection = 0;
  norm1.forEach(o1 => { if (norm2.some(o2 => o2 === o1)) intersection++; });
  return intersection / Math.max(opcoes1.length, opcoes2.length);
}

function contentHash(text: string): string {
  return createHash('sha256')
    .update(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ''))
    .digest('hex');
}

export function buildQuestionFingerprint(text: string, maxTerms = 10): string {
  return Array.from(new Set(normalizedTokens(text))).slice(0, maxTerms).join(' ');
}

export function findDuplicateQuestionIds(questions: Question[]): number[] {
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

  // Similaridade local: Dice de bigramas + contenção de termos. Não usa IA nem API externa.
  for (let current = 0; current < ordered.length; current += 1) {
    if (duplicates.has(ordered[current].id)) continue;
    for (let previous = 0; previous < current; previous += 1) {
      if (duplicates.has(ordered[previous].id)) continue;
      const bigramSimilarity = diceBigramSimilarity(ordered[current].enunciado, ordered[previous].enunciado);
      const containment = containmentSimilarity(ordered[current].enunciado, ordered[previous].enunciado);
      const optionsOverlap = optionsOverlapSimilarity(ordered[current].opcoes, ordered[previous].opcoes);
      if (bigramSimilarity >= DUPLICATE_BIGRAM_THRESHOLD
        || containment >= DUPLICATE_CONTAINMENT_THRESHOLD
        || (containment >= 0.6 && optionsOverlap >= DUPLICATE_OPTIONS_THRESHOLD)) {
        duplicates.add(ordered[current].id);
        break;
      }
    }
  }

  return Array.from(duplicates).sort((a, b) => a - b);
}

export function getQuestionGroundingIssues(question: Question): string[] {
  if (!question.sources?.length) return [];
  const issues: string[] = [];
  const sourcePages = new Set(question.sources.map((source) => source.pageNumber));
  const citedPages = Array.from(question.justificativa.matchAll(/p[aá]ginas?\s+([\d,\s-]+)/gi))
    .flatMap((match) => match[1].match(/\d+/g) || [])
    .map(Number);
  if (citedPages.length === 0) issues.push('justificativa sem página-fonte');
  else if (citedPages.some((page) => !sourcePages.has(page))) issues.push('página citada não pertence às fontes recuperadas');

  const correctOption = question.tipo === 'multipla_escolha'
    ? question.opcoes.find((option) => option.startsWith(`${question.resposta_correta})`)) || ''
    : question.resposta_correta;
  const correctTerms = tokenSet(correctOption.replace(/^[A-E]\)\s*/, ''));
  const claimTerms = tokenSet(`${correctOption} ${question.justificativa}`);
  const sourceTerms = tokenSet(question.sources.map((source) => source.excerpt).join(' '));
  let supportedTerms = 0;
  claimTerms.forEach((term) => { if (sourceTerms.has(term)) supportedTerms += 1; });
  let supportedCorrectTerms = 0;
  correctTerms.forEach((term) => { if (sourceTerms.has(term)) supportedCorrectTerms += 1; });
  const coverage = claimTerms.size ? supportedTerms / claimTerms.size : 0;
  if (correctTerms.size > 0 && supportedCorrectTerms === 0 && claimTerms.size >= 5 && coverage < 0.12) {
    issues.push('baixo apoio lexical nas fontes recuperadas');
  }
  return issues;
}

export function normalizeQuestionSourceCitation(question: Question): Question {
  if (!question.sources?.length) return question;
  const pages = Array.from(new Set(question.sources.map((source) => source.pageNumber)))
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((a, b) => a - b)
    .slice(0, 6);
  if (!pages.length) return question;

  const withoutUnverifiedPages = question.justificativa
    .replace(/\s*(?:fonte(?:s)?(?:\s+verificada(?:s)?)?\s*:\s*)?p[aá]ginas?\s+\d+(?:\s*(?:,|e|-)\s*\d+)*\.?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[;,]\s*$/, '.');
  const citation = `Fonte verificada: ${pages.length === 1 ? 'Página' : 'Páginas'} ${pages.join(', ')}.`;
  const maxExplanationLength = Math.max(0, 1000 - citation.length - 2);
  const explanation = withoutUnverifiedPages
    .slice(0, maxExplanationLength)
    .trim()
    .replace(/[;,]\s*$/, '.');
  return {
    ...question,
    justificativa: `${explanation}${explanation && !explanation.endsWith('.') ? '.' : ''} ${citation}`.trim(),
  };
}

export function getQuestionQualityIssues(
  question: Question,
): string[] {
  const issues: string[] = [];
  const normalizedOptions = question.opcoes.map((option) => option
    .replace(/^[A-E]\)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR'));
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    issues.push('alternativas duplicadas');
  }
  const correctOption = question.tipo === 'multipla_escolha'
    ? question.opcoes.find((option) => option.startsWith(`${question.resposta_correta})`))
    : question.opcoes.find((option) => option === question.resposta_correta);
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
