import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviders, generateQuizBatchWithFallback, getMaxTokensForBatch, getQuizBatchJsonSchema } from '@/lib/ai-providers';
import type { AIProvider } from '@/types/quiz';

const validBatch = {
  titulo: 'Simulado de teste',
  questoes: [{
    id: 7,
    tipo: 'multipla_escolha',
    tema: 'Tema de teste',
    enunciado: 'Enunciado suficientemente detalhado para a questão sete.',
    opcoes: ['A) Alternativa um', 'B) Alternativa dois', 'C) Alternativa três', 'D) Alternativa quatro'],
    resposta_correta: 'A',
    justificativa: 'Justificativa fundamentada para a questão sete.',
    dificuldade: 'Médio',
  }],
};

describe('AI provider request', () => {
  it('aligns the strict provider schema with the selected exam format', () => {
    const trueFalse = getQuizBatchJsonSchema(1, 5, 'TRUE_FALSE')
    const fiveOptions = getQuizBatchJsonSchema(1, 5, 'FIVE_OPTIONS')
    expect(trueFalse.properties.questoes.items.properties.tipo.enum).toEqual(['certo_errado'])
    expect(trueFalse.properties.questoes.items.properties.resposta_correta.enum).toEqual(['Certo', 'Errado'])
    expect(fiveOptions.properties.questoes.items.properties.opcoes.minItems).toBe(5)
    expect(fiveOptions.properties.questoes.items.properties.resposta_correta.enum).toContain('E')
  })
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.OPENROUTER_API_KEY = originalApiKey;
  });

  it('scales the output budget by batch size and only expands it on retry', () => {
    expect(getMaxTokensForBatch(1, 1)).toBe(1_320);
    expect(getMaxTokensForBatch(5, 1)).toBe(3_400);
    expect(getMaxTokensForBatch(5, 2)).toBe(4_100);
  });

  it('continues after errors and invalid JSON', async () => {
    const providers: AIProvider[] = [
      { name: 'offline', isAvailable: () => false, generate: vi.fn() },
      { name: 'broken', isAvailable: () => true, generate: vi.fn().mockRejectedValue(new Error('429')) },
      { name: 'invalid', isAvailable: () => true, generate: vi.fn().mockResolvedValue('{"bad":true}') },
      { name: 'working', isAvailable: () => true, generate: vi.fn().mockResolvedValue(JSON.stringify(validBatch)) },
    ];
    const result = await generateQuizBatchWithFallback('system', 'user', 7, 1, providers);
    expect(result.providerUsed).toBe('working');
    expect(result.batch.questoes).toHaveLength(1);
    expect(result.batch.questoes[0].id).toBe(7);
  });

  it('sends a strict JSON Schema request to OpenRouter', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validBatch) } }],
      usage: { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateQuizBatchWithFallback('system', 'user', 7, 1, [aiProviders[0]]);
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(String(request?.body));

    expect(result.batch.questoes[0].id).toBe(7);
    expect(result.metrics).toMatchObject({ requests: 1, retries: 0, totalTokens: 600 });
    // Compara com o modelo realmente configurado (env) ou com o padrão do código,
    // para o teste não defasar quando o modelo for trocado.
    expect(body.model).toBe(process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.questoes.items.properties.id).toEqual({
      type: 'integer', minimum: 7, maximum: 7,
    });
    expect(body.provider).toEqual({ require_parameters: true, allow_fallbacks: true });
    expect(body.reasoning_effort).toBe('none');
    expect(body.max_tokens).toBe(getMaxTokensForBatch(1, 1));
  });

  it('retries a truncated response with a larger output budget and concise instructions', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ finish_reason: 'length', message: { content: '{"titulo":"incompleto"' } }],
        usage: { completion_tokens: getMaxTokensForBatch(1, 1) },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validBatch) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateQuizBatchWithFallback('system', 'user', 7, 1, [aiProviders[0]]);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    expect(result.batch.questoes[0].id).toBe(7);
    expect(secondBody.max_tokens).toBeGreaterThan(firstBody.max_tokens);
    expect(secondBody.messages[1].content).toContain('CORREÇÃO DE TAMANHO');
  });

  it('accepts text content returned as content parts', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: { content: [{ type: 'text', text: JSON.stringify(validBatch) }] },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateQuizBatchWithFallback('system', 'user', 7, 1, [aiProviders[0]]);
    expect(result.batch.questoes[0].id).toBe(7);
  });
});
