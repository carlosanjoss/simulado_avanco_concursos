import { describe, expect, it } from 'vitest';
import { answerSubmissionSchema, attemptSubmissionSchema, feedbackSubmissionSchema } from '@/lib/validations/attempt';

describe('attempt API validation', () => {
  it('accepts configurable quizzes up to 50 questions and rejects higher indexes', () => {
    expect(answerSubmissionSchema.safeParse({ simuladoId: 'quiz', questionId: 31, answer: 'A' }).success).toBe(true);
    expect(answerSubmissionSchema.safeParse({ simuladoId: 'quiz', questionId: 50, answer: 'A' }).success).toBe(true);
    expect(answerSubmissionSchema.safeParse({ simuladoId: 'quiz', questionId: 51, answer: 'A' }).success).toBe(false);
  });

  it('accepts a valid final submission and rejects extra fields', () => {
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: { 1: 'A' }, selectedAnswers: { 1: 'A' }, elapsedSeconds: 120, totalQuestoes: 30, isFinal: true }).success).toBe(true);
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: {}, selectedAnswers: {}, totalQuestoes: 50, isFinal: false }).success).toBe(true);
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: {}, selectedAnswers: {}, totalQuestoes: 51, isFinal: false }).success).toBe(false);
    expect(attemptSubmissionSchema.safeParse({ simuladoId: 'quiz', respostas: {}, selectedAnswers: {}, isFinal: false, injected: true }).success).toBe(false);
  });

  it('requires a useful feedback message', () => {
    expect(feedbackSubmissionSchema.safeParse({ simuladoId: 'quiz', questaoId: 1, type: 'other', message: 'x' }).success).toBe(false);
  });
});
