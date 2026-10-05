import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '@/lib/quiz-evaluation';
import type { Question } from '@/types/quiz';

describe('quiz evaluation evidence', () => {
  it('returns PDF provenance only with the answer evaluation', () => {
    const question: Question = {
      id: 1,
      tipo: 'multipla_escolha',
      tema: 'Teste',
      enunciado: 'Qual alternativa está correta?',
      opcoes: ['A) Correta', 'B) Incorreta', 'C) Outra', 'D) Nenhuma'],
      resposta_correta: 'A',
      justificativa: 'A alternativa A é sustentada pelo documento. Página 12.',
      dificuldade: 'Médio',
      sources: [{ chunkId: '42', pageNumber: 12, excerpt: 'Trecho comprobatório.', similarity: 0.91 }],
    };

    expect(evaluateAnswer(question, 'A) Correta')).toMatchObject({
      correct: true,
      sources: question.sources,
    });
  });
});
