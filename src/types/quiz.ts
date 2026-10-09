export type QuestionType = 'multipla_escolha' | 'certo_errado' | 'discursiva';
export type QuestionDifficulty = 'Fácil' | 'Médio' | 'Avançado';

export interface QuestionSource {
  chunkId: string;
  documentId?: string;
  documentName?: string;
  pageNumber: number;
  excerpt: string;
  similarity: number;
}

export interface Question {
  id: number;
  tipo: QuestionType;
  tema: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  justificativa: string;
  dificuldade: QuestionDifficulty;
  sources?: QuestionSource[];
  reviewCardId?: string;
}

export type PublicQuestion = Omit<Question, 'resposta_correta' | 'justificativa' | 'sources' | 'reviewCardId'>;

export interface QuestionEvaluation {
  correct: boolean | null;
  correctAnswer: string;
  justification: string;
  sources?: QuestionSource[];
}

export interface Quiz {
  titulo: string;
  total_questoes: number;
  questoes: Question[];
}

export interface QuizAnswer {
  questionId: number;
  answer: string;
  correct: boolean | null;
}

export interface QuizResult {
  score: number;
  totalObjective: number;
  correct: number;
  incorrect: number;
  discursive: number;
  percentage: number;
}

export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  generate(
    systemPrompt: string,
    userPrompt: string,
    request?: { questionId: number; attempt: number },
  ): Promise<string>;
}

export interface AIProviderStatus {
  id: string;
  name: string;
  type: 'cloud';
  configured: boolean;
  model: string;
}
