import { z } from 'zod';

const answerMapSchema = z.record(
  z.string().trim().min(1).max(10_000),
).refine((answers) => Object.keys(answers).length <= 30, 'Máximo de 30 respostas.');

export const answerSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  questionId: z.number().int().min(1).max(30),
  answer: z.string().trim().min(1).max(10_000),
}).strict();

export const attemptSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  respostas: answerMapSchema.default({}),
  selectedAnswers: answerMapSchema.default({}),
  currentIndex: z.number().int().min(0).max(29).optional(),
  elapsedSeconds: z.number().int().min(0).max(31_536_000).optional(),
  totalQuestoes: z.literal(30).optional(),
  isFinal: z.boolean().default(false),
}).strict();

export const feedbackSubmissionSchema = z.object({
  simuladoId: z.string().min(1).max(120),
  questaoId: z.number().int().min(1).max(30),
  type: z.enum(['incorrect_answer', 'unclear', 'not_in_document', 'other']),
  message: z.string().trim().min(3).max(1_000),
}).strict();
