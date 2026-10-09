import { z } from 'zod';

const answerMapSchema = z.record(
  z.string().trim().min(1).max(10_000),
).refine((answers) => Object.keys(answers).length <= 50, 'Máximo de 50 respostas.');

export const answerSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  questionId: z.number().int().min(1).max(50),
  answer: z.string().trim().min(1).max(10_000),
}).strict();

export const attemptSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  respostas: answerMapSchema.default({}),
  selectedAnswers: answerMapSchema.default({}),
  currentIndex: z.number().int().min(0).max(49).optional(),
  elapsedSeconds: z.number().int().min(0).max(31_536_000).optional(),
  totalQuestoes: z.number().int().min(5).max(50).optional(),
  isFinal: z.boolean().default(false),
}).strict();

export const feedbackSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  questaoId: z.number().int().min(1).max(50),
  type: z.enum(['incorrect_answer', 'unclear', 'not_in_document', 'other']),
  message: z.string().trim().min(3).max(1_000),
}).strict();
