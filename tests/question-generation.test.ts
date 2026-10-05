import { describe, expect, it } from 'vitest';
import {
  findDuplicateQuestionIds,
  findSemanticDuplicateQuestionIds,
  getQuestionQualityIssues,
  mapWithConcurrency,
} from '@/lib/question-generation';
import type { Question } from '@/types/quiz';

function question(id: number, enunciado: string): Question {
  return {
    id,
    tipo: 'multipla_escolha',
    tema: 'Tema de teste',
    enunciado,
    opcoes: ['A) Um', 'B) Dois', 'C) Três', 'D) Quatro'],
    resposta_correta: 'A',
    justificativa: 'Justificativa suficientemente detalhada.',
    dificuldade: 'Médio',
  };
}

describe('question generation controls', () => {
  it('identifies the later semantically duplicated question', () => {
    const questions = [
      question(1, 'Qual é o principal fundamento constitucional descrito no documento para a administração pública?'),
      question(2, 'Segundo o texto, qual tecnologia processa os vetores semânticos localmente?'),
      question(3, 'Qual é o principal fundamento constitucional descrito no documento para a administração pública brasileira?'),
    ];
    expect(findDuplicateQuestionIds(questions)).toEqual([3]);
  });

  it('never exceeds the configured worker concurrency', async () => {
    let active = 0;
    let maximum = 0;
    const processed: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      processed.push(item);
      active -= 1;
    });
    expect(maximum).toBe(2);
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('detects paraphrases from their normalized embeddings', () => {
    const questions = [question(1, 'Primeira formulação'), question(2, 'Paráfrase'), question(3, 'Tema distinto')];
    const embeddings = [
      [1, 0, 0],
      [0.99, 0.01, 0],
      [0, 1, 0],
    ];
    expect(findSemanticDuplicateQuestionIds(questions, embeddings)).toEqual([2]);
  });

  it('rejects duplicated alternatives and unsupported mathematical answers', () => {
    const invalid = question(1, 'Qual é o resultado do cálculo apresentado?');
    invalid.opcoes = ['A) 10', 'B) 10', 'C) 12', 'D) 14'];
    invalid.justificativa = 'A resposta decorre do conteúdo apresentado.';
    expect(getQuestionQualityIssues(invalid, 'mathematics')).toEqual([
      'alternativas duplicadas',
      'justificativa matemática sem cálculo verificável',
    ]);
  });
});
