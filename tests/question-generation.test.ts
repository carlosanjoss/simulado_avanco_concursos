import { describe, expect, it } from 'vitest'
import {
  buildQuestionFingerprint,
  findDuplicateQuestionIds,
  getQuestionGroundingIssues,
  getQuestionQualityIssues,
  mapWithConcurrency,
  normalizeQuestionSourceCitation,
} from '@/lib/question-generation'
import type { Question } from '@/types/quiz'

function question(id: number, enunciado: string): Question {
  return {
    id,
    tipo: 'multipla_escolha',
    tema: 'Tema de teste',
    enunciado,
    opcoes: ['A) Um', 'B) Dois', 'C) Três', 'D) Quatro'],
    resposta_correta: 'A',
    justificativa: 'Justificativa suficientemente detalhada.',
    dificuldade: 'Médio',
  }
}

describe('question generation controls', () => {
  it('identifies the later duplicated question', () => {
    const questions = [
      question(1, 'Qual é o principal fundamento constitucional descrito no documento para a administração pública?'),
      question(2, 'Segundo o texto, qual tecnologia processa os vetores semânticos localmente?'),
      question(3, 'Qual é o principal fundamento constitucional descrito no documento para a administração pública brasileira?'),
    ]
    expect(findDuplicateQuestionIds(questions)).toEqual([3])
  })

  it('detects paraphrased duplicates locally without an AI request', () => {
    const questions = [
      question(1, 'Em que situação a administração pública deve aplicar o princípio da legalidade ao editar um ato administrativo?'),
      question(2, 'Ao editar um ato administrativo, em qual situação a administração pública aplica o princípio da legalidade?'),
      question(3, 'Qual é o prazo de vigência contratual previsto para a hipótese excepcional descrita no material?'),
    ]
    expect(findDuplicateQuestionIds(questions)).toEqual([2])
    expect(buildQuestionFingerprint(questions[0].enunciado)).toContain('administracao')
  })

  it('checks page citations and lexical support using only retrieved sources', () => {
    const grounded = question(1, 'Qual princípio limita a atuação da administração pública?')
    grounded.opcoes[0] = 'A) O princípio da legalidade limita a atuação administrativa.'
    grounded.justificativa = 'A alternativa A está correta porque a legalidade limita a atuação administrativa. B, C e D contrariam a regra. Página 12.'
    grounded.sources = [{ chunkId: 'chunk-1', pageNumber: 12, excerpt: 'O princípio da legalidade limita a atuação da administração pública.', similarity: 0.91 }]
    expect(getQuestionGroundingIssues(grounded)).toEqual([])

    grounded.justificativa = 'A resposta decorre de regra completamente externa e sem apoio no trecho. Página 99.'
    expect(getQuestionGroundingIssues(grounded)).toContain('página citada não pertence às fontes recuperadas')
  })

  it('replaces an AI-invented page with the page from the retrieved source', () => {
    const generated = question(1, 'Qual princípio limita a atuação da administração pública?')
    generated.opcoes[0] = 'A) O princípio da legalidade limita a atuação administrativa.'
    generated.justificativa = 'A alternativa A está correta porque a legalidade limita a atuação administrativa. As demais contrariam a regra. Página 99.'
    generated.sources = [{
      chunkId: 'chunk-8',
      pageNumber: 8,
      excerpt: 'O princípio da legalidade limita a atuação da administração pública.',
      similarity: 0.94,
    }]

    const normalized = normalizeQuestionSourceCitation(generated)

    expect(normalized.justificativa).not.toContain('Página 99')
    expect(normalized.justificativa).toContain('Fonte verificada: Página 8.')
    expect(normalized.justificativa.length).toBeLessThanOrEqual(1000)
    expect(getQuestionGroundingIssues(normalized)).toEqual([])
  })

  it('never exceeds the configured worker concurrency', async () => {
    let active = 0
    let maximum = 0
    const processed: number[] = []
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      processed.push(item)
      active -= 1
    })
    expect(maximum).toBe(2)
    expect(processed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('rejects duplicated alternatives', () => {
    const invalid = question(1, 'Qual é o resultado do cálculo apresentado?')
    invalid.opcoes = ['A) 10', 'B) 10', 'C) 12', 'D) 14']
    invalid.justificativa = 'A resposta decorre do conteúdo apresentado.'
    expect(getQuestionQualityIssues(invalid)).toEqual(['alternativas duplicadas'])
  })
})
