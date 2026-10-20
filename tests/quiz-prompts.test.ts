import { describe, expect, it } from 'vitest'
import { buildQuizPrompts } from '@/lib/prompts/quiz-generation'

describe('quiz generation prompts', () => {
  it('requests exactly one question for regeneration batches', () => {
    const prompts = buildQuizPrompts({
      context: '[Material · Página 2] Conteúdo de teste.',
      totalQuestions: 30,
      batch: { startId: 16, count: 1, previousQuestions: [] },
    })
    expect(prompts.systemPrompt).toContain('Gere exatamente 1 questão, com IDs sequenciais de 16 a 16')
    expect(prompts.systemPrompt).not.toContain('IDs sequenciais de 1 a 30')
  })

  it('uses compact fingerprints and a distinct objective for every id', () => {
    const prompts = buildQuizPrompts({
      context: 'Contexto',
      totalQuestions: 20,
      batch: { startId: 6, count: 2, previousQuestions: ['Qual é o principal fundamento constitucional descrito no documento?'] },
      questionObjectives: [
        { id: 6, objective: 'competência administrativa', pageFrom: 10, pageTo: 11 },
        { id: 7, objective: 'prazo contratual', pageFrom: 12, pageTo: 12 },
      ],
    })
    expect(prompts.systemPrompt).toContain('ID 6: competência administrativa; fonte: páginas 10-11')
    expect(prompts.systemPrompt).toContain('ID 7: prazo contratual; fonte: página 12')
    expect(prompts.systemPrompt).toContain('principal fundamento constitucional descrito')
  })

  it('applies board style and certo/errado schema without another request', () => {
    const prompts = buildQuizPrompts({
      context: 'Contexto', totalQuestions: 10, examBoard: 'CEBRASPE', answerFormat: 'TRUE_FALSE',
      batch: { startId: 1, count: 2, previousQuestions: [] },
    })
    expect(prompts.systemPrompt).toContain('estilo Cebraspe')
    expect(prompts.systemPrompt).toContain('"tipo":"certo_errado"')
    expect(prompts.systemPrompt).toContain('["Certo","Errado"]')
  })

  it('does not seed the model with answers or page numbers from another material', () => {
    const prompts = buildQuizPrompts({
      context: '[Material atual · Página 8] O princípio da legalidade limita a atuação administrativa.',
      totalQuestions: 10,
      batch: { startId: 1, count: 1, previousQuestions: [] },
    })

    expect(prompts.systemPrompt).not.toContain('Resposta correta:')
    expect(prompts.systemPrompt).not.toContain('Página 12')
  })
})
