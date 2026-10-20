import type { Question } from '@/types/quiz'

export const QUALITY_BENCHMARK_PAGES = [
  'A administração pública deve obedecer ao princípio da legalidade. O agente público somente pode agir quando houver autorização normativa.',
  'A publicidade promove transparência dos atos administrativos, ressalvadas as hipóteses legais de sigilo para proteção do interesse público.',
  'A eficiência exige resultados adequados com uso responsável dos recursos públicos, sem afastar os demais princípios administrativos.',
]

export const QUALITY_BENCHMARK_EXPECTED_CONCEPTS = ['legalidade', 'publicidade', 'eficiência']

export const QUALITY_BENCHMARK_QUESTIONS: Question[] = QUALITY_BENCHMARK_PAGES.map((excerpt, index) => ({
  id: index + 1,
  tipo: 'multipla_escolha',
  tema: `Princípio ${QUALITY_BENCHMARK_EXPECTED_CONCEPTS[index]}`,
  enunciado: [
    'Um agente pretende praticar ato sem autorização normativa. Qual princípio impede essa conduta?',
    'A administração deve divulgar um ato que não está protegido por sigilo. Qual princípio fundamenta a divulgação?',
    'Um órgão busca melhores resultados sem desperdiçar recursos. Qual princípio orienta essa atuação?',
  ][index],
  opcoes: [
    `A) ${QUALITY_BENCHMARK_EXPECTED_CONCEPTS[index]}`,
    'B) Irretroatividade',
    'C) Autonomia privada',
    'D) Livre iniciativa',
  ],
  resposta_correta: 'A',
  justificativa: `A alternativa A corresponde ao princípio da ${QUALITY_BENCHMARK_EXPECTED_CONCEPTS[index]}, conforme o trecho. As demais alternativas não descrevem a regra administrativa apresentada. Página ${index + 1}.`,
  dificuldade: 'Médio',
  sources: [{ chunkId: `benchmark-${index + 1}`, pageNumber: index + 1, excerpt, similarity: 1 }],
}))
