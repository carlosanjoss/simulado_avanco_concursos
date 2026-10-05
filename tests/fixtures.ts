import type { Quiz } from '@/types/quiz';

export function makeValidQuiz(): Quiz {
  return {
    titulo: 'Simulado de teste',
    total_questoes: 30,
    questoes: Array.from({ length: 30 }, (_, index) => {
      const id = index + 1;
      return {
        id,
        tipo: 'multipla_escolha',
        tema: index % 2 === 0 ? 'Fundamentos' : 'Aplicações',
        enunciado: `Enunciado suficientemente detalhado para a questão ${id}.`,
        opcoes: ['A) Alternativa um', 'B) Alternativa dois', 'C) Alternativa três', 'D) Alternativa quatro'],
        resposta_correta: 'A',
        justificativa: `Justificativa fundamentada para a questão ${id}.`,
        dificuldade: index % 2 === 0 ? 'Médio' : 'Avançado',
      };
    }),
  };
}
