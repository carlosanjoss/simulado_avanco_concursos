export function normalizeQuestionTags(tags: string[]): string[] {
  const normalized = tags.map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)
  const unique = new Map<string, string>()
  for (const tag of normalized) {
    const key = tag.toLocaleLowerCase('pt-BR')
    if (!unique.has(key)) unique.set(key, tag)
  }
  return [...unique.values()].slice(0, 12)
}

export function hasLicensedOfficialSource(input: { sourceType: string; sourceName?: string | null; licenseReference?: string | null }): boolean {
  if (input.sourceType !== 'OFFICIAL_LICENSED') return true
  return Boolean(input.sourceName?.trim() && input.licenseReference?.trim())
}
