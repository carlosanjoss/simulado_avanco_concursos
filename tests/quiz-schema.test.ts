import { describe, expect, it } from 'vitest';
import { parseQuizBatchResponse, parseQuizResponse } from '@/lib/validations/quiz';
import { makeValidQuiz } from './fixtures';

describe('quiz JSON schema', () => {
  it('accepts exactly 30 sequential questions containing both formats', () => {
    expect(parseQuizResponse(JSON.stringify(makeValidQuiz())).questoes).toHaveLength(30);
  });

  it('rejects a quiz with fewer questions or invalid option labels', () => {
    const short = makeValidQuiz();
    short.questoes.pop();
    expect(() => parseQuizResponse(JSON.stringify(short))).toThrow();

    const invalid = makeValidQuiz();
    invalid.questoes[0].opcoes[0] = 'Alternativa sem letra';
    expect(() => parseQuizResponse(JSON.stringify(invalid))).toThrow();
  });
});

describe('quiz batch schema', () => {
  it('accepts exactly one sequential question for the requested block', () => {
    const quiz = makeValidQuiz();
    const batch = { titulo: quiz.titulo, questoes: quiz.questoes.slice(10, 11) };
    expect(parseQuizBatchResponse(JSON.stringify(batch), 11).questoes).toHaveLength(1);
  });

  it('rejects a block with IDs from another range', () => {
    const quiz = makeValidQuiz();
    const batch = { titulo: quiz.titulo, questoes: quiz.questoes.slice(0, 1) };
    expect(() => parseQuizBatchResponse(JSON.stringify(batch), 11)).toThrow(/ID da questão deve ser 11/);
  });
});
