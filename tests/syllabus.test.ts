import { describe, expect, it } from 'vitest'
import { parseSyllabusText, topicMatchesText } from '@/lib/syllabus'

describe('syllabus parser', () => {
  it('groups headings and semicolon-separated topics without AI', () => {
    const parsed = parseSyllabusText('DIREITO CONSTITUCIONAL\n1. Direitos fundamentais; controle de constitucionalidade\nDIREITO ADMINISTRATIVO\n1. Atos administrativos; licitações')
    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0].topics.map((item) => item.title)).toContain('Direitos fundamentais')
    expect(parsed.sections[1].topics).toHaveLength(2)
  })

  it('matches a topic with a related question theme', () => {
    expect(topicMatchesText('Controle de constitucionalidade', 'Direito Constitucional - controle concentrado de constitucionalidade')).toBe(true)
  })

  it('keeps unique ids when long topic names share the same slug prefix', () => {
    const prefix = 'Um conteúdo programático muito extenso que compartilha exatamente o mesmo início para testar colisões '
    const parsed = parseSyllabusText(`CONHECIMENTOS GERAIS\n${prefix}primeiro; ${prefix}segundo`)
    const ids = parsed.sections.flatMap((section) => section.topics.map((topic) => topic.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
