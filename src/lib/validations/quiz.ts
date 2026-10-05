import { z } from 'zod';

const baseQuestion = {
  id: z.number().int().min(1).max(30),
  tema: z.string().trim().min(2).max(80).default('Conteúdo geral'),
  enunciado: z.string().trim().min(10),
  justificativa: z.string().trim().min(10),
  dificuldade: z.enum(['Médio', 'Avançado']),
  sources: z.array(z.object({
    chunkId: z.string().min(1),
    pageNumber: z.number().int().positive(),
    excerpt: z.string().min(1).max(600),
    similarity: z.number().min(-1).max(1),
  })).max(12).optional(),
};

const multipleChoiceSchema = z.object({
  ...baseQuestion,
  tipo: z.literal('multipla_escolha'),
  opcoes: z.tuple([
    z.string().regex(/^A\)\s*.+/), z.string().regex(/^B\)\s*.+/),
    z.string().regex(/^C\)\s*.+/), z.string().regex(/^D\)\s*.+/),
  ]),
  resposta_correta: z.enum(['A', 'B', 'C', 'D']),
});

export const questionSchema = z.discriminatedUnion('tipo', [multipleChoiceSchema]);

export const quizSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  total_questoes: z.literal(30),
  questoes: z.array(questionSchema).length(30),
}).superRefine((quiz, context) => {
  const ids = quiz.questoes.map((question) => question.id);
  if (ids.some((id, index) => id !== index + 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['questoes'], message: 'Os IDs devem ser sequenciais de 1 a 30.' });
  }
});

const quizBatchSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  questoes: z.array(questionSchema).length(1),
});

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('INVALID_AI_JSON');
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error('INVALID_AI_JSON');
    }
  }
}

function normalizeQuestionTypes(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const object = value as Record<string, unknown>;
  if (!Array.isArray(object.questoes)) return value;
  return {
    ...object,
    questoes: object.questoes.map((question) => {
      if (!question || typeof question !== 'object' || Array.isArray(question)) return question;
      const normalizedQuestion = { ...(question as Record<string, unknown>) };
      if (typeof normalizedQuestion.tipo === 'string') {
        const normalized = normalizedQuestion.tipo
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_');
        if (normalized === 'multipla_escolha' || normalized === 'multiplaescolha') {
          normalizedQuestion.tipo = 'multipla_escolha';
        }
      }
      return normalizedQuestion;
    }),
  };
}

export function parseQuizResponse(content: string) {
  try {
    const parsed = normalizeQuestionTypes(parseJsonObject(content));
    const result = quizSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`INVALID_AI_SCHEMA: ${result.error.issues.map((issue) => issue.message).join('; ')}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_AI_SCHEMA')) throw error;
    throw new Error(`INVALID_AI_SCHEMA: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function parseQuizBatchResponse(content: string, startId: number) {
  try {
    const parsed = normalizeQuestionTypes(parseJsonObject(content));
    const result = quizBatchSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`INVALID_AI_SCHEMA: ${result.error.issues.map((issue) => issue.message).join('; ')}`);
    }
    const expectedIds = [startId]; // Only 1 question per batch now
    const receivedIds = result.data.questoes.map((question) => question.id);
    if (receivedIds.some((id, index) => id !== expectedIds[index])) {
      throw new Error(`INVALID_AI_SCHEMA: o ID da questão deve ser ${startId}.`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_AI_SCHEMA')) throw error;
    throw new Error(`INVALID_AI_SCHEMA: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
