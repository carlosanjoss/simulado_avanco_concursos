import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviders, generateQuizBatchWithFallback } from '@/lib/ai-providers';
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
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.OPENROUTER_API_KEY = originalApiKey;
  });

  it('continues after errors and invalid JSON', async () => {
    const providers: AIProvider[] = [
      { name: 'offline', isAvailable: () => false, generate: vi.fn() },
      { name: 'broken', isAvailable: () => true, generate: vi.fn().mockRejectedValue(new Error('429')) },
      { name: 'invalid', isAvailable: () => true, generate: vi.fn().mockResolvedValue('{"bad":true}') },
      { name: 'working', isAvailable: () => true, generate: vi.fn().mockResolvedValue(JSON.stringify(validBatch)) },
    ];
    const result = await generateQuizBatchWithFallback('system', 'user', 7, providers);
    expect(result.providerUsed).toBe('working');
    expect(result.batch.questoes).toHaveLength(1);
    expect(result.batch.questoes[0].id).toBe(7);
  });

  it('sends a strict JSON Schema request to OpenRouter', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validBatch) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateQuizBatchWithFallback('system', 'user', 7, [aiProviders[0]]);
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(String(request?.body));

    expect(result.batch.questoes[0].id).toBe(7);
    // Compara com o modelo realmente configurado (env) ou com o padrão do código,
    // para o teste não defasar quando o modelo for trocado.
    expect(body.model).toBe(process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.questoes.items.properties.id).toEqual({
      type: 'integer', minimum: 7, maximum: 7,
    });
    expect(body.provider).toEqual({ require_parameters: true, allow_fallbacks: true });
    expect(body.reasoning_effort).toBe('none');
  });

  it('accepts text content returned as content parts', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: { content: [{ type: 'text', text: JSON.stringify(validBatch) }] },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateQuizBatchWithFallback('system', 'user', 7, [aiProviders[0]]);
    expect(result.batch.questoes[0].id).toBe(7);
  });
});
