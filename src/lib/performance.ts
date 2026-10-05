import type { PublicQuestion, QuestionEvaluation } from '@/types/quiz';

export interface PerformanceGroup {
  label: string;
  total: number;
  answered: number;
  correct: number;
  percentage: number;
}

type PerformanceDimension = 'tipo' | 'tema' | 'dificuldade';

const typeLabels: Record<string, string> = {
  multipla_escolha: 'Múltipla escolha',
  certo_errado: 'Certo ou errado',
  discursiva: 'Discursiva',
};

function groupLabel(question: PublicQuestion, dimension: PerformanceDimension, fallbackTheme: string) {
  if (dimension === 'tipo') return typeLabels[question.tipo] || question.tipo.replaceAll('_', ' ');
  if (dimension === 'dificuldade') return question.dificuldade;
  return question.tema?.trim() || fallbackTheme;
}

export function buildPerformanceGroups(
  questions: PublicQuestion[],
  evaluations: Record<number, QuestionEvaluation>,
  dimension: PerformanceDimension,
  fallbackTheme = 'Conteúdo geral',
): PerformanceGroup[] {
  const groups = new Map<string, Omit<PerformanceGroup, 'percentage'>>();

  questions.forEach((question) => {
    const label = groupLabel(question, dimension, fallbackTheme);
    const current = groups.get(label) || { label, total: 0, answered: 0, correct: 0 };
    current.total += 1;
    const evaluation = evaluations[question.id];
    if (evaluation) current.answered += 1;
    if (evaluation?.correct === true) current.correct += 1;
    groups.set(label, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      percentage: group.answered ? Math.round((group.correct / group.answered) * 100) : 0,
    }))
    .sort((first, second) => second.total - first.total || first.label.localeCompare(second.label, 'pt-BR'));
}
