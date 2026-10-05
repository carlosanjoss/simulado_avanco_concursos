import { describe, expect, it } from 'vitest';
import { buildPerformanceGroups } from '@/lib/performance';
import type { PublicQuestion, QuestionEvaluation } from '@/types/quiz';

const questions: PublicQuestion[] = [
  { id: 1, tipo: 'multipla_escolha', tema: 'Constituição', enunciado: 'Enunciado número um', opcoes: [], dificuldade: 'Médio' },
  { id: 2, tipo: 'multipla_escolha', tema: 'Constituição', enunciado: 'Enunciado número dois', opcoes: [], dificuldade: 'Avançado' },
  { id: 3, tipo: 'multipla_escolha', tema: 'Administração', enunciado: 'Enunciado número três', opcoes: [], dificuldade: 'Médio' },
];

const evaluations: Record<number, QuestionEvaluation> = {
  1: { correct: true, correctAnswer: 'A', justification: 'Correta' },
  2: { correct: false, correctAnswer: 'B', justification: 'Incorreta' },
  3: { correct: true, correctAnswer: 'C', justification: 'Correta' },
};

describe('performance breakdown', () => {
  it('groups results by theme', () => {
    expect(buildPerformanceGroups(questions, evaluations, 'tema')).toEqual([
      { label: 'Constituição', total: 2, answered: 2, correct: 1, percentage: 50 },
      { label: 'Administração', total: 1, answered: 1, correct: 1, percentage: 100 },
    ]);
  });

  it('groups results by difficulty and type', () => {
    expect(buildPerformanceGroups(questions, evaluations, 'dificuldade')[0]).toMatchObject({ label: 'Médio', total: 2, percentage: 100 });
    expect(buildPerformanceGroups(questions, evaluations, 'tipo')).toEqual([
      { label: 'Múltipla escolha', total: 3, answered: 3, correct: 2, percentage: 67 },
    ]);
  });
});
