import type { Question, QuestionEvaluation } from '@/types/quiz';

export function getCorrectAnswerText(question: Question): string {
  if (question.tipo !== 'multipla_escolha') return question.resposta_correta;
  return question.opcoes.find((option) => option.startsWith(`${question.resposta_correta})`))
    || question.resposta_correta;
}

export function evaluateAnswer(question: Question, answer: string | undefined): QuestionEvaluation {
  const correctAnswer = getCorrectAnswerText(question);
  const correct = question.tipo === 'discursiva'
    ? null
    : Boolean(answer) && (question.tipo === 'multipla_escolha'
      ? answer === correctAnswer
      : answer === question.resposta_correta);

  return {
    correct,
    correctAnswer,
    justification: question.justificativa,
    sources: question.sources,
  };
}
