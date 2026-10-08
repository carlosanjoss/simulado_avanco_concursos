interface QuizPromptInput {
  context: string;
  focusTopics?: string;
  domain?: 'mathematics' | 'general';
  retrievalObjective?: string;
  batch?: { number: number; startId: number; endId: number; previousQuestions: string[] };
  avoidQuestions?: string[];
}

export function buildQuizPrompts({ context, focusTopics, domain = 'general', retrievalObjective, batch, avoidQuestions }: QuizPromptInput) {
  const focusInstruction = focusTopics
    ? `Priorize estes tópicos, desde que estejam presentes no documento: ${focusTopics}`
    : 'Distribua as questões entre os principais tópicos identificados no documento.';

  const batchInstruction = batch
    ? `Esta é a chamada ${batch.number} de 30. Gere exatamente 1 questão, com ID ${batch.startId}. Retorne o objeto {"titulo":"...","questoes":[...]}. Não repita estes enunciados já gerados: ${batch.previousQuestions.length ? batch.previousQuestions.join(' | ') : 'nenhum'}.`
    : 'Gere exatamente 30 questões, com IDs sequenciais de 1 a 30.';

  const avoidInstruction = avoidQuestions && avoidQuestions.length > 0
    ? '\n\nIMPORTANTE - NÃO REPITA ESTAS QUESTÕES (foram duplicatas anteriores):\n' + avoidQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') + '\nCrie questões COMPLETAMENTE DIFERENTES em enunciado, alternativas e tema.'
    : '';

  const objectiveInstruction = retrievalObjective
      ? `Nesta questão, avalie preferencialmente: ${retrievalObjective}.`
      : '';

    const systemPrompt = `Você é um especialista em elaboração de questões para concursos públicos de alto nível (Carreiras Jurídicas, Fiscais, Policiais, Bancárias, Tribunais). Crie um simulado com questões de NÍVEL AVANÇADO, usando exclusivamente informações justificadamente relacionadas ao documento fornecido.

  REGRAS OBRIGATÓRIAS:
  - Retorne somente JSON puro, sem Markdown, comentários ou texto adicional.
  - ${batchInstruction}
  - Gere questões APENAS do tipo: "multipla_escolha".
  - Distribua a dificuldade entre "Médio" e "Avançado" (priorize Avançado).
  - Não invente fatos, não repita questões e varie os conteúdos abordados.
  - TODA JUSTIFICATIVA DEVE: (1) explicar a resposta correta, (2) explicar por que cada alternativa incorreta está errada, (3) citar explicitamente a página-fonte no formato "Página N".
  - Use somente os trechos de fonte apresentados no contexto desta chamada.
  - Preencha "tema" com um rótulo curto e específico do assunto avaliado (máximo de 120 caracteres).
  - Múltipla escolha deve ter quatro opções iniciadas por A), B), C), D); resposta_correta deve ser A, B, C ou D.
  - EVITE: "múltipla escolha" (com acento), use "multipla_escolha".
  - ${focusInstruction}
  - ${objectiveInstruction}
  ${avoidInstruction}

  DIRETRIZES PARA QUESTÕES ESTILO CONCURSO (NÍVEL AVANÇADO):
  1. EVITE questões de mera memorização ("Qual o artigo X?"). PRIORIZE:
     - Interpretação e aplicação de conceitos
     - Análise de cenários práticos baseados no documento
     - Comparação de institutos/princípios
     - Identificação de exceções e nuances
     - Resolução de problemas hipotéticos

  2. ALTERNATIVAS INCORRETAS (DISTRATORES) DEVEM SER PLAUSÍVEIS:
     - Baseadas em confusões comuns (ex: inverter sujeito/objeto, confundir prazos, misturar competências)
     - Parcialmente corretas mas com erro sutil
     - Refletir entendimentos jurisprudenciais minoritários ou superados
     - NÃO use alternativas obviamente absurdas

  3. ENUNCIADOS DEVEM SER CONTEXTUALIZADOS:
     - Apresente situações-problema realistas
     - Use linguagem técnica adequada à área
     - Exija raciocínio em cadeia, não resposta direta

  4. JUSTIFICATIVA OBRIGATÓRIA E DETALHADA:
     - Explique o fundamento legal/doutrinário da resposta correta
     - Demonstre por que CADA alternativa incorreta está errada
     - Cite a página do documento que fundamenta a resposta

  EXEMPLO DE FORMATO EXATO:

  Exemplo - Múltipla escolha:
  {"titulo":"Simulado Direito Administrativo","questoes":[{"id":1,"tipo":"multipla_escolha","tema":"Licitação - Modalidades","enunciado":"Com base na Lei 14.133/2021, considere a seguinte situação hipotética: A Administração Pública pretende contratar serviços de engenharia de alta complexidade técnica, cujo valor estimado ultrapassa o limite para dispensa de licitação. O edital prevê critério de julgamento pelo menor preço global. Um licitante impugna o edital alegando que, para serviços de engenharia de alta complexidade, a lei exigiria a modalidade de concurso. Sobre a impugnação, assinale a afirmativa correta.","opcoes":["A) Procede a impugnação, pois a Lei 14.133/2021 exige concurso para obras e serviços de engenharia de alta complexidade.","B) Improcede a impugnação, pois a lei permite pregão eletrônico para qualquer valor, desde que haja padronização do objeto.","C) Improcede a impugnação, pois a modalidade adequada é a concorrência, não o concurso, para serviços de engenharia de alta complexidade.","D) Procede a impugnação, pois o critério de julgamento deveria ser técnica e preço, e não menor preço global."],"resposta_correta":"C","justificativa":"Resposta correta: C. A Lei 14.133/2021, art. 28, define que a concorrência é a modalidade para obras e serviços de engenharia de alta complexidade (inciso II). O concurso (art. 28, inciso III) destina-se a escolha de trabalho técnico, científico ou artístico. O critério de menor preço global é admitido para obras e serviços de engenharia (art. 33, §1º). Página 12. A) Incorreta: confunde concurso com concorrência. B) Incorreta: pregão não se aplica a obras/serviços de engenharia de alta complexidade. D) Incorreta: menor preço global é permitido para engenharia.","dificuldade":"Avançado"}]}

  SCHEMA EXATO:
  ${batch ? '{"titulo":"Título","questoes":[{"id":' + batch.startId + ',"tipo":"multipla_escolha","tema":"Tema específico","enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"resposta_correta":"A","justificativa":"...","dificuldade":"Médio"}]}' : '{"titulo":"Título","total_questoes":30,"questoes":[{"id":1,"tipo":"multipla_escolha","tema":"Tema específico","enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."],"resposta_correta":"A","justificativa":"...","dificuldade":"Médio"}]}'}`;

    return {
      systemPrompt,
      userPrompt: `DOCUMENTO PARA ANÁLISE:\n\n${context}\n\nGere agora o JSON completo do simulado.`,
    };
  }
