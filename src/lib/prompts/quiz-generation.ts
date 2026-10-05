interface QuizPromptInput {
  context: string;
  focusTopics?: string;
  domain?: 'mathematics' | 'general';
  retrievalObjective?: string;
  batch?: { number: number; startId: number; endId: number; previousQuestions: string[] };
}

export function buildQuizPrompts({ context, focusTopics, domain = 'general', retrievalObjective, batch }: QuizPromptInput) {
  const focusInstruction = focusTopics
    ? `Priorize estes tópicos, desde que estejam presentes no documento: ${focusTopics}`
    : 'Distribua as questões entre os principais tópicos identificados no documento.';

  const batchInstruction = batch
    ? `Esta é a chamada ${batch.number} de 30. Gere exatamente 1 questão, com ID ${batch.startId}. Retorne o objeto {"titulo":"...","questoes":[...]}. Não repita estes enunciados já gerados: ${batch.previousQuestions.length ? batch.previousQuestions.join(' | ') : 'nenhum'}.`
    : 'Gere exatamente 30 questões, com IDs sequenciais de 1 a 30.';

  const objectiveInstruction = retrievalObjective
    ? `Nesta questão, avalie preferencialmente: ${retrievalObjective}.`
    : '';

  const mathematicsRules = domain === 'mathematics'
    ? `
REGRAS ADICIONAIS PARA MATEMÁTICA E CONTEÚDO QUANTITATIVO:
- Inclua no enunciado todos os dados necessários para resolver o problema.
- Resolva o cálculo antes de definir as alternativas e garanta que exista exatamente uma resposta correta.
- Use distratores plausíveis derivados de erros comuns de cálculo, sem alternativas duplicadas ou equivalentes.
- Declare unidades, hipóteses e critérios de arredondamento quando forem necessários.
- Na justificativa, mostre a sequência de cálculo de forma verificável e cite a página-fonte.
- Preserve fórmulas com notação textual clara; não invente valores que não estejam sustentados pelas fontes.`
    : '';

  const systemPrompt = `Você é um especialista em avaliação educacional. Crie um simulado usando exclusivamente informações justificadamente relacionadas ao documento fornecido.

REGRAS OBRIGATÓRIAS:
- Retorne somente JSON puro, sem Markdown, comentários ou texto adicional.
- ${batchInstruction}
- Gere questões APENAS do tipo: "multipla_escolha".
- Distribua a dificuldade entre "Médio" e "Avançado".
- Não invente fatos, não repita questões e varie os conteúdos abordados.
- Toda justificativa deve explicar a resposta usando o documento e citar explicitamente a página-fonte no formato "Página N".
- Use somente os trechos de fonte apresentados no contexto desta chamada. Os identificadores de chunk servem apenas para rastreabilidade.
- Preencha "tema" com um rótulo curto e específico do assunto avaliado (máximo de 80 caracteres).
- Múltipla escolha deve ter quatro opções iniciadas por A), B), C), D); resposta_correta deve ser A, B, C ou D.
- EVITE: "múltipla escolha" (com acento), use "multipla_escolha".
- ${focusInstruction}
- ${objectiveInstruction}
${mathematicsRules}

EXEMPLOS DE FORMATO EXATO:

Exemplo - Múltipla escolha:
{"titulo":"Exemplo","questoes":[{"id":1,"tipo":"multipla_escolha","tema":"Organização do Estado","enunciado":"Qual a capital do Brasil?","opcoes":["A) Rio de Janeiro","B) São Paulo","C) Brasília","D) Salvador"],"resposta_correta":"C","justificativa":"Brasília é a capital federal do Brasil desde 1960.","dificuldade":"Médio"}]}

SCHEMA EXATO:
${batch ? '{"titulo":"Título","questoes":[{"id":' + batch.startId + ',"tipo":"multipla_escolha","tema":"Tema específico","enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"resposta_correta":"A","justificativa":"...","dificuldade":"Médio"}]}' : '{"titulo":"Título","total_questoes":30,"questoes":[{"id":1,"tipo":"multipla_escolha","tema":"Tema específico","enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"resposta_correta":"A","justificativa":"...","dificuldade":"Médio"}]}'}`;

  return {
    systemPrompt,
    userPrompt: `DOCUMENTO PARA ANÁLISE:\n\n${context}\n\nGere agora o JSON completo do simulado.`,
  };
}
