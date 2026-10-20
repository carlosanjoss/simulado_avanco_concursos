export interface SyllabusTopic {
  id: string
  subject: string
  title: string
}

export interface SyllabusSection {
  id: string
  title: string
  topics: SyllabusTopic[]
}

export interface ParsedSyllabus {
  sections: SyllabusSection[]
  warnings: string[]
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^[•●▪◦\-–—]+\s*/, '').trim()
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
}

function isHeading(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length < 4 || line.length > 120) return false
  const upperRatio = [...letters].filter((char) => char === char.toUpperCase()).length / letters.length
  return upperRatio > 0.82 || /^(conhecimentos|conte[uú]do|disciplina|mat[eé]ria)\b/i.test(line)
}

function splitTopics(line: string) {
  const withoutPrefix = line.replace(/^\d+(?:\.\d+)*[.)-]?\s*/, '')
  return withoutPrefix.split(/\s*(?:;|\u2022|\s[–—]\s)\s*/).map(cleanLine).filter((item) => item.length >= 3 && item.length <= 220)
}

export function parseSyllabusText(rawText: string): ParsedSyllabus {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean)
  const sections: SyllabusSection[] = []
  let current: SyllabusSection | null = null
  const seen = new Set<string>()

  const ensureSection = (title = 'Conteúdo programático') => {
    if (current) return current
    current = { id: slug(title) || 'conteudo-programatico', title, topics: [] }
    sections.push(current)
    return current
  }

  for (const line of lines) {
    if (isHeading(line)) {
      const title = line.replace(/:$/, '').trim()
      current = { id: `${slug(title) || 'secao'}-${sections.length + 1}`, title, topics: [] }
      sections.push(current)
      continue
    }
    const section = ensureSection()
    for (const title of splitTopics(line)) {
      if (/^(anexo|edital|p[aá]gina\s+\d+|cargo|das disposi[cç][oõ]es)/i.test(title)) continue
      const key = `${section.title}:${title}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const position = section.topics.length + 1
      section.topics.push({ id: `${section.id}-${slug(title) || 'topico'}-${position}`, subject: section.title, title })
    }
  }

  const useful = sections.filter((section) => section.topics.length > 0).slice(0, 60)
  const limited = useful.map((section) => ({ ...section, topics: section.topics.slice(0, 120) }))
  const total = limited.reduce((sum, section) => sum + section.topics.length, 0)
  return {
    sections: limited,
    warnings: total < 5 ? ['Poucos tópicos foram identificados. Revise o texto extraído antes de salvar.'] : [],
  }
}

export function normalizeTopicText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function topicMatchesText(topic: string, text: string) {
  const topicTokens = normalizeTopicText(topic).split(' ').filter((token) => token.length >= 4)
  const normalizedText = normalizeTopicText(text)
  if (!topicTokens.length) return false
  return topicTokens.filter((token) => normalizedText.includes(token)).length >= Math.min(2, topicTokens.length)
}
