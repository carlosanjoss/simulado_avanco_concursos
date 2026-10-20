import { parseQuizBatchResponse } from '@/lib/validations/quiz';
import type { AIProvider, AIProviderResponse, AIProviderStatus, AIProviderUsage } from '@/types/quiz';

const OPENROUTER_TIMEOUT_MS = 180_000;
const PROVIDER_ATTEMPTS = 2;
// 5 questões por batch = 6 batches para 30 questões
export const QUESTIONS_PER_BATCH = 5;
export const TOTAL_BATCHES = 6;

class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryable = false,
    readonly retryAfterMs?: number,
    readonly usage?: Partial<AIProviderUsage>,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface QuizGenerationMetrics extends AIProviderUsage {
  requests: number;
  retries: number;
  truncations: number;
}

type ErrorWithGenerationMetrics = Error & { generationMetrics?: QuizGenerationMetrics };

export function getQuizGenerationMetrics(error: unknown): QuizGenerationMetrics | undefined {
  return error instanceof Error ? (error as ErrorWithGenerationMetrics).generationMetrics : undefined;
}

function emptyMetrics(): QuizGenerationMetrics {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0, retries: 0, truncations: 0 };
}

function addUsage(metrics: QuizGenerationMetrics, usage?: Partial<AIProviderUsage>): void {
  metrics.promptTokens += usage?.promptTokens || 0;
  metrics.completionTokens += usage?.completionTokens || 0;
  metrics.totalTokens += usage?.totalTokens || 0;
}

type OpenRouterResponse = {
  error?: { message?: string; code?: string | number };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      refusal?: string | null;
    };
  }>;
};

function normalizedUsage(data: OpenRouterResponse): Partial<AIProviderUsage> | undefined {
  if (!data.usage) return undefined;
  return {
    promptTokens: data.usage.prompt_tokens || 0,
    completionTokens: data.usage.completion_tokens || 0,
    totalTokens: data.usage.total_tokens || 0,
  };
}

export function getMaxTokensForBatch(count: number, attempt: number): number {
  const safeCount = Math.max(1, Math.min(count, QUESTIONS_PER_BATCH));
  const retryAllowance = attempt > 1 ? 700 : 0;
  return Math.min(4_800, 800 + safeCount * 520 + retryAllowance);
}

function isConfigured(value: string | undefined): boolean {
  return Boolean(value && !/(sua_chave|your_|\.\.\.)/i.test(value));
}

export function getQuizBatchJsonSchema(startId: number, count: number, answerFormat: 'FOUR_OPTIONS' | 'FIVE_OPTIONS' | 'TRUE_FALSE' = 'FOUR_OPTIONS') {
  const endId = startId + count - 1;
  const trueFalse = answerFormat === 'TRUE_FALSE';
  const optionCount = answerFormat === 'FIVE_OPTIONS' ? 5 : trueFalse ? 2 : 4;
  const correctAnswers = trueFalse ? ['Certo', 'Errado'] : answerFormat === 'FIVE_OPTIONS' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
  return {
    type: 'object',
    properties: {
      titulo: {
        type: 'string', minLength: 3, maxLength: 160,
        description: 'Título curto do simulado em português.',
      },
      questoes: {
        type: 'array', minItems: count, maxItems: count,
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', minimum: startId, maximum: endId },
            tipo: { type: 'string', enum: [trueFalse ? 'certo_errado' : 'multipla_escolha'] },
            tema: { type: 'string', minLength: 2, maxLength: 80 },
            enunciado: { type: 'string', minLength: 10, maxLength: 700 },
            opcoes: {
              type: 'array', minItems: optionCount, maxItems: optionCount,
              items: { type: 'string', minLength: 3, maxLength: 300 },
              description: trueFalse ? 'Exatamente as opções Certo e Errado.' : `${optionCount} alternativas em ordem alfabética.`,
            },
            resposta_correta: { type: 'string', enum: correctAnswers },
            justificativa: { type: 'string', minLength: 10, maxLength: 1_000 },
            dificuldade: { type: 'string', enum: ['Fácil', 'Médio', 'Avançado'] },
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
  startId: number;
  count: number;
  attempt: number;
  answerFormat?: 'FOUR_OPTIONS' | 'FIVE_OPTIONS' | 'TRUE_FALSE';
  headers?: Record<string, string>;
  timeoutMs?: number;
}) {
  const maxTokens = getMaxTokensForBatch(options.count, options.attempt);
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
        // Temperature dinâmica: 0.1 base (fatos) + variação controlada
        temperature: 0.15,
        max_tokens: maxTokens,
        reasoning_effort: 'none',
        seed: options.startId * 100 + options.attempt,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: `lote_${options.startId}_${options.count}`,
            strict: true,
            schema: getQuizBatchJsonSchema(options.startId, options.count, options.answerFormat),
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
  if (choice?.finish_reason === 'length') {
    const completionTokens = data.usage?.completion_tokens;
    throw new ProviderError(
      `OPENROUTER_OUTPUT_TRUNCATED: completion_tokens=${completionTokens ?? 'unknown'}, max_tokens=${maxTokens}`,
      options.provider,
      response.status,
      true,
      undefined,
      normalizedUsage(data),
    );
  }
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
  return { content, usage: normalizedUsage(data) } satisfies AIProviderResponse;
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
      startId: request?.startId ?? 1,
      count: request?.count ?? QUESTIONS_PER_BATCH,
      attempt: request?.attempt ?? 1,
      answerFormat: request?.answerFormat,
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
    model: () => process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash',
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
  count: number = QUESTIONS_PER_BATCH,
  providers: AIProvider[] = aiProviders,
  answerFormat: 'FOUR_OPTIONS' | 'FIVE_OPTIONS' | 'TRUE_FALSE' = 'FOUR_OPTIONS',
) {
  let lastError: Error | null = null;
  const metrics = emptyMetrics();
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        metrics.requests += 1;
        if (attempt > 1) metrics.retries += 1;
        const wasTruncated = lastError?.message.startsWith('OPENROUTER_OUTPUT_TRUNCATED');
        const correction = attempt > 1
          ? wasTruncated
            ? '\n\nCORREÇÃO DE TAMANHO: a resposta anterior foi truncada. Refaça o lote inteiro em JSON válido e completo. Preserve a análise, mas seja direto: enunciados, alternativas e justificativas devem respeitar rigorosamente os limites de caracteres solicitados.'
            : '\n\nCORREÇÃO OBRIGATÓRIA: retorne somente o JSON completo exigido, sem markdown nem texto adicional.'
          : '';
        const response = await provider.generate(systemPrompt, `${userPrompt}${correction}`, {
          startId,
          count,
          attempt,
          answerFormat,
        });
        const rawResponse = typeof response === 'string' ? response : response.content;
        if (typeof response !== 'string') addUsage(metrics, response.usage);
        const batch = parseQuizBatchResponse(rawResponse, startId, count);
        return { batch, providerUsed: provider.name, metrics };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown provider error');
        if (error instanceof ProviderError) {
          addUsage(metrics, error.usage);
          if (error.message.startsWith('OPENROUTER_OUTPUT_TRUNCATED')) metrics.truncations += 1;
        }
        console.warn(`[AI:${provider.name}:batch-${startId}:attempt-${attempt}] failed: ${lastError.message}`);
        if (!shouldRetry(lastError) || attempt === PROVIDER_ATTEMPTS) break;
        await waitBeforeRetry(lastError, attempt);
      }
    }
  }
  const failure = (lastError || new Error('AI_UNAVAILABLE')) as ErrorWithGenerationMetrics;
  failure.generationMetrics = metrics;
  throw failure;
}

export function getProviderConfiguration(): AIProviderStatus[] {
  return [
    {
      id: 'openrouter', name: 'OpenRouter', type: 'cloud',
      configured: isConfigured(process.env.OPENROUTER_API_KEY),
      model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash',
    },
  ];
}
