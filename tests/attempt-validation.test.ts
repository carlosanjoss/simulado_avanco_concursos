import { describe, expect, it } from 'vitest';
import { answerSubmissionSchema, attemptSubmissionSchema, feedbackSubmissionSchema } from '@/lib/validations/attempt';

describe('attempt API validation', () => {
  it('rejects answers outside the fixed 30-question quiz', () => {
    expect(answerSubmissionSchema.safeParse({ simuladoId: 'quiz', questionId: 31, answer: 'A' }).success).toBe(false);
  });

  it('accepts a valid final submission and rejects extra fields', () => {
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: { 1: 'A' }, selectedAnswers: { 1: 'A' }, elapsedSeconds: 120, totalQuestoes: 30, isFinal: true }).success).toBe(true);
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: {}, selectedAnswers: {}, isFinal: false, injected: true }).success).toBe(false);
  });

  it('requires a useful feedback message', () => {
    expect(feedbackSubmissionSchema.safeParse({ simuladoId: 'quiz', questaoId: 1, type: 'other', message: 'x' }).success).toBe(false);
  });
});
