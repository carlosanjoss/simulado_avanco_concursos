import { parseQuizBatchResponse } from '@/lib/validations/quiz';
import type { AIProvider, AIProviderStatus } from '@/types/quiz';

const OPENROUTER_TIMEOUT_MS = 300_000;
const MAX_TOKENS_PER_QUESTION = 2_500;
const PROVIDER_ATTEMPTS = 2;
export const QUESTIONS_PER_BATCH = 1;
export const TOTAL_BATCHES = 30;

class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryable = false,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

type OpenRouterResponse = {
  error?: { message?: string; code?: string | number };
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      refusal?: string | null;
    };
  }>;
};

function isConfigured(value: string | undefined): boolean {
  return Boolean(value && !/(sua_chave|your_|\.\.\.)/i.test(value));
}

function quizQuestionJsonSchema(startId: number) {
  return {
    type: 'object',
    properties: {
      titulo: {
        type: 'string', minLength: 3, maxLength: 160,
        description: 'Título curto do simulado em português.',
      },
      questoes: {
        type: 'array', minItems: 1, maxItems: 1,
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', minimum: startId, maximum: startId },
            tipo: { type: 'string', enum: ['multipla_escolha'] },
            tema: { type: 'string', minLength: 2, maxLength: 80 },
            enunciado: { type: 'string', minLength: 10 },
            opcoes: {
              type: 'array', minItems: 4, maxItems: 4,
              items: { type: 'string', minLength: 3 },
              description: 'Quatro alternativas na ordem A), B), C) e D).',
            },
            resposta_correta: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            justificativa: { type: 'string', minLength: 10 },
            dificuldade: { type: 'string', enum: ['Médio', 'Avançado'] },
          },
          required: [
            'id', 'tipo', 'tema', 'enunciado', 'opcoes',
            'resposta_correta', 'justificativa', 'dificuldade',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['titulo', 'questoes'],
    additionalProperties: false,
  } as const;
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function safeProviderMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function responseContent(data: OpenRouterResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join('\n');
}

async function requestOpenRouter(options: {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  questionId: number;
  attempt: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}) {
  let response: Response;
  try {
    response = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: 0.1,
        max_tokens: MAX_TOKENS_PER_QUESTION,
        reasoning_effort: 'none',
        seed: options.questionId * 100 + options.attempt,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: `questao_${options.questionId}`,
            strict: true,
            schema: quizQuestionJsonSchema(options.questionId),
          },
        },
        provider: { require_parameters: true, allow_fallbacks: true },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? OPENROUTER_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    throw new ProviderError(`OPENROUTER_CONNECTION_ERROR: ${message}`, options.provider, undefined, true);
  }

  const responseText = await response.text();
  let data: OpenRouterResponse;
  try {
    data = responseText ? JSON.parse(responseText) as OpenRouterResponse : {};
  } catch {
    throw new ProviderError(
      `OPENROUTER_INVALID_RESPONSE: HTTP ${response.status} retornou um corpo inválido`,
      options.provider,
      response.status,
      isRetryableHttpStatus(response.status),
      retryAfterMilliseconds(response),
    );
  }

  const apiError = safeProviderMessage(data.error?.message);
  if (!response.ok || data.error) {
    const bodyStatus = Number(data.error?.code);
    const status = Number.isInteger(bodyStatus) && bodyStatus >= 400 ? bodyStatus : response.status;
    throw new ProviderError(
      `OPENROUTER_API_ERROR: ${apiError || `HTTP ${status}`}`,
      options.provider,
      status,
      isRetryableHttpStatus(status),
      retryAfterMilliseconds(response),
    );
  }

  const choice = data.choices?.[0];
  const content = responseContent(data);
  if (!content) {
    const refusal = safeProviderMessage(choice?.message?.refusal);
    const finishReason = choice?.finish_reason || 'missing';
    throw new ProviderError(
      refusal
        ? `OPENROUTER_REFUSAL: ${refusal}`
        : `OPENROUTER_EMPTY_RESPONSE: finish_reason=${finishReason}`,
      options.provider,
      response.status,
      !refusal,
    );
  }
  if (choice?.finish_reason === 'length') {
    throw new ProviderError('OPENROUTER_OUTPUT_TRUNCATED', options.provider, response.status, true);
  }
  return content;
}

function createOpenRouterProvider(options: {
  name: string;
  endpoint: string;
  apiKey: () => string | undefined;
  model: () => string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): AIProvider {
  return {
    name: options.name,
    isAvailable: () => isConfigured(options.apiKey()),
    generate: (systemPrompt, userPrompt, request) => requestOpenRouter({
      provider: options.name,
      endpoint: options.endpoint,
      apiKey: options.apiKey()!,
      model: options.model(),
      systemPrompt,
      userPrompt,
      questionId: request?.questionId ?? 1,
      attempt: request?.attempt ?? 1,
      headers: options.headers,
      timeoutMs: options.timeoutMs,
    }),
  };
}

export const aiProviders: AIProvider[] = [
  createOpenRouterProvider({
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: () => process.env.OPENROUTER_API_KEY,
    model: () => process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Avanço Simulados',
    },
    timeoutMs: OPENROUTER_TIMEOUT_MS,
  }),
];

function shouldRetry(error: Error): boolean {
  return error.message.startsWith('INVALID_AI_SCHEMA')
    || (error instanceof ProviderError && error.retryable);
}

async function waitBeforeRetry(error: Error, attempt: number): Promise<void> {
  const providerDelay = error instanceof ProviderError ? error.retryAfterMs : undefined;
  const delay = Math.min(providerDelay ?? 500 * (2 ** (attempt - 1)), 5_000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function generateQuizBatchWithFallback(
  systemPrompt: string,
  userPrompt: string,
  startId: number,
  providers: AIProvider[] = aiProviders,
) {
  let lastError: Error | null = null;
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        const correction = attempt > 1
          ? '\n\nCORREÇÃO OBRIGATÓRIA: retorne somente o JSON completo exigido, sem markdown nem texto adicional.'
          : '';
        const rawResponse = await provider.generate(systemPrompt, `${userPrompt}${correction}`, {
          questionId: startId,
          attempt,
        });
        const batch = parseQuizBatchResponse(rawResponse, startId);
        return { batch, providerUsed: provider.name };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown provider error');
        console.warn(`[AI:${provider.name}:batch-${startId}:attempt-${attempt}] failed: ${lastError.message}`);
        if (!shouldRetry(lastError) || attempt === PROVIDER_ATTEMPTS) break;
        await waitBeforeRetry(lastError, attempt);
      }
    }
  }
  throw lastError || new Error('AI_UNAVAILABLE');
}

export function getProviderConfiguration(): AIProviderStatus[] {
  return [
    {
      id: 'openrouter', name: 'OpenRouter', type: 'cloud',
      configured: isConfigured(process.env.OPENROUTER_API_KEY),
      model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731',
    },
  ];
}
