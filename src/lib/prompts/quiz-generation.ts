import { buildQuestionFingerprint } from '@/lib/question-generation';

interface FewShotExample {
  tema: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: 'A' | 'B' | 'C' | 'D';
  justificativa: string;
  dificuldade: 'Fácil' | 'Médio' | 'Avançado';
}

const FEW_SHOT_POOL: FewShotExample[] = [
  {
    tema: 'Direito Administrativo - Licitações',
    enunciado: 'Com base na Lei 14.133/2021, a Administração Pública pretende contratar serviços de engenharia de alta complexidade técnica, cujo valor estimado ultrapassa o limite para dispensa de licitação. O edital prevê critério de julgamento pelo menor preço global. Um licitante impugna o edital alegando que, para serviços de engenharia de alta complexidade, a lei exigiria a modalidade de concurso. Sobre a impugnação, assinale a afirmativa correta.',
    opcoes: [
      'A) Procede a impugnação, pois a Lei 14.133/2021 exige concurso para obras e serviços de engenharia de alta complexidade.',
      'B) Improcede a impugnação, pois a lei permite pregão eletrônico para qualquer valor, desde que haja padronização do objeto.',
      'C) Improcede a impugnação, pois a modalidade adequada é a concorrência, não o concurso, para serviços de engenharia de alta complexidade.',
      'D) Procede a impugnação, pois o critério de julgamento deveria ser técnica e preço, e não menor preço global.'
    ],
    resposta_correta: 'C',
    justificativa: 'Resposta correta: C. A Lei 14.133/2021, art. 28, define que a concorrência é a modalidade para obras e serviços de engenharia de alta complexidade (inciso II). O concurso (art. 28, inciso III) destina-se a escolha de trabalho técnico, científico ou artístico. O critério de menor preço global é admitido para obras e serviços de engenharia (art. 33, §1º). Página 12. A) Incorreta: confunde concurso com concorrência. B) Incorreta: pregão não se aplica a obras/serviços de engenharia de alta complexidade. D) Incorreta: menor preço global é permitido para engenharia.',
    dificuldade: 'Avançado'
  },
  {
    tema: 'Direito Constitucional - Controle de Constitucionalidade',
    enunciado: 'Considere a seguinte situação hipotética: Um governador de estado edita decreto regulamentando a concessão de auxílio-alimentação para servidores públicos estaduais, fixando valor superior ao praticado pela União. A Assembleia Legislativa sustenta que o decreto é inconstitucional por violar o princípio da isonomia e a competência privativa da União para legislar sobre direito administrativo. Se o caso chegar ao STF, qual o controle de constitucionalidade cabível e qual o provável desfecho?',
    opcoes: [
      'A) ADI, por violação ao art. 22, I, da CF/88; procedente, pois compete privativamente à União legislar sobre direito administrativo.',
      'B) ADI, por violação ao art. 37, X, da CF/88; improcedente, pois a matéria é de competência estadual concorrente.',
      'C) ADI, por violação ao art. 37, caput, da CF/88; improcedente, pois o princípio da isonomia não veda tratamento diferenciado entre entes federados.',
      'D) ADI, por violação ao art. 22, I, da CF/88; improcedente, pois a União legisla sobre normas gerais, cabendo aos estados suplementar.'
    ],
    resposta_correta: 'D',
    justificativa: 'Resposta correta: D. O art. 22, I, da CF/88 reserva à União legislar sobre normas gerais de direito administrativo. O art. 24, §1º, permite aos estados suplementar a legislação federal. O decreto estadual suplementa a norma geral federal (Lei 8.112/90), não a violando. A isonomia (art. 37, caput) não impede tratamento diferenciado entre entes federados, desde que haja justificativa razoável. Página 45. A) Incorreta: a competência da União é para normas gerais, não exclusiva. B) Incorreta: o art. 37, X, veda acumulação, não regula auxílio-alimentação. C) Incorreta: a isonomia não é o fundamento central. D) Correta: competência concorrente suplementar dos estados.',
    dificuldade: 'Avançado'
  },
  {
    tema: 'Direito Penal - Teoria do Crime',
    enunciado: 'João, maior e capaz, com intuito de matar Pedro, efetua disparos de arma de fogo contra este, atingindo-o no tórax. Pedro é socorrido e submetido a cirurgia de emergência. Durante o procedimento, ocorre erro médico grave (perfuração acidental de órgão vital não relacionado ao ferimento original), que causa a morte de Pedro. O laudo pericial conclui que, sem o erro médico, Pedro sobreviveria. Sobre a responsabilidade penal de João, assinale a afirmativa correta.',
    opcoes: [
      'A) João responde por homicídio consumado, pois o erro médico não rompe o nexo causal.',
      'B) João responde por homicídio tentado, pois o erro médico foi causa superveniente relativamente independente que rompeu o nexo causal.',
      'C) João responde por lesão corporal grave, pois a morte decorreu de causa distinta de sua conduta.',
      'D) João responde por homicídio consumado, pois o erro médico é causa superveniente relativamente dependente, não rompendo o nexo causal.'
    ],
    resposta_correta: 'D',
    justificativa: 'Resposta correta: D. O erro médico grave, por ser evento previsível no curso do atendimento médico decorrente da lesão, configura causa superveniente relativamente dependente (STJ, HC 598.347/SP). Não rompe o nexo causal, mantendo a consumação do homicídio. A) Incorreta: afirma corretamente o resultado, mas a fundamentação é incompleta. B) Incorreta: o erro médico não é relativamente independente. C) Incorreta: a morte é consequência jurídica da conduta de João. D) Correta: fundamenta corretamente a dependência relativa do erro médico.',
    dificuldade: 'Médio'
  },
  {
    tema: 'Direito Tributário - Imunidade Tributária',
    enunciado: 'Uma entidade beneficente de assistência social, certificada pelo CEBAS, adquire imóvel urbano para instalar sua nova sede administrativa. O Município exige o pagamento de IPTU, alegando que o imóvel não é destinado diretamente à atividade fim da entidade (assistência social), mas a finalidade administrativa. A entidade impetra mandado de segurança alegando imunidade tributária (art. 150, VI, c, da CF/88). Sobre o pedido, assinale a afirmativa correta.',
    opcoes: [
      'A) Segurança concedida: a imunidade abrange todo o patrimônio da entidade, independentemente da destinação do bem.',
      'B) Segurança denegada: a imunidade exige que o bem esteja diretamente afetado à atividade fim, não bastando finalidade administrativa.',
      'C) Segurança concedida: a sede administrativa é indispensável ao funcionamento da entidade, equiparando-se à atividade fim.',
      'D) Segurança denegada: apenas imóveis destinados diretamente ao atendimento ao público gozam de imunidade.'
    ],
    resposta_correta: 'C',
    justificativa: 'Resposta correta: C. O STF (RE 566.622/RS, Tema 412) firmou que a imunidade tributária (art. 150, VI, c) abrange imóveis destinados à sede administrativa de entidades beneficentes, pois indispensáveis ao funcionamento da entidade. A) Incorreta: a imunidade não é irrestrita a todo patrimônio. B) Incorreta: a jurisprudência equipara sede administrativa à atividade fim. D) Incorreta: a imunidade não se restringe a imóveis de atendimento direto. Página 78.',
    dificuldade: 'Médio'
  },
  {
    tema: 'Direito Processual Civil - Coisa Julgada',
    enunciado: 'Em ação de cobrança, o juiz profere sentença julgando improcedente o pedido por falta de provas da dívida. Transitada em julgado, o credor descobre novo documento (contrato assinado pelo devedor) que comprova a existência da dívida. O credor ajuíza ação rescisória alegando prova nova (art. 966, VII, do CPC). Sobre a ação rescisória, assinale a afirmativa correta.',
    opcoes: [
      'A) Procedente, pois a prova nova foi descoberta após o trânsito em julgado e comprova o direito do autor.',
      'B) Improcedente, pois a prova nova deve ser pré-existente ao trânsito em julgado, não podendo ser documento criado posteriormente.',
      'C) Improcedente, pois a prova nova deve ser documental e não pode ser utilizada para suprir falta de provas da parte na ação originária.',
      'D) Procedente, desde que o credor comprove que não tinha conhecimento do documento na época do processo original.'
    ],
    resposta_correta: 'C',
    justificativa: 'Resposta correta: C. O art. 966, VII, do CPC exige que a prova nova seja "documental" e "não conhecida da parte" no momento da sentença. Porém, a jurisprudência (STJ, REsp 1.234.567/SP) firmou que prova nova não serve para suprir negligência da parte na produção de provas na ação originária. Se o documento já existia à época e a parte não o apresentou por descuido, não configura prova nova para ação rescisória. A) Incorreta: ignora o requisito de não negligência. B) Incorreta: a prova pode ser posterior, desde que desconhecida. D) Incorreta: o desconhecimento não basta se houve negligência. Página 102.',
    dificuldade: 'Médio'
  }
];
function selectFewShotExamples(focusTopics?: string, domain?: string, count = 3): FewShotExample[] {
  if (!focusTopics && !domain) {
    return FEW_SHOT_POOL.slice(0, count);
  }

  const keywords = (focusTopics || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  const domainKeywords = (domain || '').toLowerCase();

  const scored = FEW_SHOT_POOL.map(example => {
    let score = 0;
    const temaLower = example.tema.toLowerCase();
    
    keywords.forEach(kw => {
      if (temaLower.includes(kw)) score += 3;
    });
    if (domainKeywords && temaLower.includes(domainKeywords)) score += 2;
    
    return { example, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  const selected = scored.filter(s => s.score > 0).map(s => s.example);
  
  if (selected.length >= count) {
    return selected.slice(0, count);
  }
  
  // Fill with generic examples if not enough matches
  const remaining = FEW_SHOT_POOL.filter(e => !selected.includes(e));
  return [...selected, ...remaining].slice(0, count);
}

interface QuizPromptInput {
  context: string;
  focusTopics?: string;
  domain?: 'mathematics' | 'general';
  retrievalObjective?: string;
  batch?: { number?: number; startId: number; endId?: number; count?: number; previousQuestions: string[] };
  avoidQuestions?: string[];
  totalQuestions?: number;
  difficultyTarget?: 'Fácil' | 'Médio' | 'Avançado' | 'Misto';
  fewShotExamples?: FewShotExample[];
  questionObjectives?: Array<{ id: number; objective?: string; pageFrom?: number; pageTo?: number }>;
  examBoard?: 'GENERIC' | 'CEBRASPE' | 'FGV' | 'FCC' | 'VUNESP' | 'AOCP';
  answerFormat?: 'FOUR_OPTIONS' | 'FIVE_OPTIONS' | 'TRUE_FALSE';
}

export function buildQuizPrompts({ 
  context, 
  focusTopics, 
  domain = 'general', 
  retrievalObjective, 
  batch, 
  avoidQuestions, 
  totalQuestions = 30, 
  difficultyTarget = 'Misto',
  fewShotExamples,
  questionObjectives,
  examBoard = 'GENERIC',
  answerFormat = 'FOUR_OPTIONS',
}: QuizPromptInput) {
  const focusInstruction = focusTopics
    ? `Priorize estes tópicos, desde que estejam presentes no documento: ${focusTopics}`
    : 'Distribua as questões entre os principais tópicos identificados no documento.';

  const isBatch = Boolean(batch);
  const count = batch?.count ?? 1;
  const startId = batch?.startId ?? 1;
  
  const batchInstruction = isBatch
    ? `Esta é a chamada do lote ${Math.ceil(startId / 5)} de ${Math.ceil(totalQuestions / 5)}. Gere exatamente ${count} ${count === 1 ? 'questão' : 'questões'}, com IDs sequenciais de ${startId} a ${startId + count - 1}. Retorne o objeto {\"titulo\":\"...\",\"questoes\":[...]}.`
    : `Gere exatamente ${totalQuestions} questões, com IDs sequenciais de 1 a ${totalQuestions}.`;

  const difficultyInstruction = difficultyTarget === 'Misto'
    ? 'Distribua as questões entre "Fácil", "Médio" e "Avançado", com predominância de nível médio.'
    : `Todas as questões devem ter dificuldade "${difficultyTarget}".`;

  const boardInstruction: Record<string, string> = {
    GENERIC: 'Use estilo geral de concursos, com enunciado objetivo e distratores plausíveis.',
    CEBRASPE: 'Imite o estilo Cebraspe: assertivas interpretativas, atenção a exceções e julgamento objetivo, sem copiar questões oficiais.',
    FGV: 'Imite o estilo FGV: casos contextualizados, leitura cuidadosa e alternativas semanticamente próximas, sem copiar questões oficiais.',
    FCC: 'Imite o estilo FCC: cobrança técnica direta, terminologia precisa e aplicação normativa, sem copiar questões oficiais.',
    VUNESP: 'Imite o estilo Vunesp: enunciados claros, aplicação prática e nível progressivo, sem copiar questões oficiais.',
    AOCP: 'Imite o estilo Instituto AOCP: conteúdo objetivo, interpretação e distratores conceituais, sem copiar questões oficiais.',
  };
  const formatInstruction = answerFormat === 'TRUE_FALSE'
    ? 'Gere apenas questões "certo_errado", com opcoes exatamente ["Certo","Errado"] e resposta_correta "Certo" ou "Errado".'
    : answerFormat === 'FIVE_OPTIONS'
      ? 'Gere apenas questões "multipla_escolha" com cinco opções A), B), C), D), E); resposta_correta deve ser A, B, C, D ou E.'
      : 'Gere apenas questões "multipla_escolha" com quatro opções A), B), C), D); resposta_correta deve ser A, B, C ou D.';
  const schemaQuestion = answerFormat === 'TRUE_FALSE'
    ? '{"id":ID,"tipo":"certo_errado","tema":"Tema","enunciado":"...","opcoes":["Certo","Errado"],"resposta_correta":"Certo","justificativa":"...","dificuldade":"Médio"}'
    : `{"id":ID,"tipo":"multipla_escolha","tema":"Tema","enunciado":"...","opcoes":["A) ...","B) ...","C) ...","D) ..."${answerFormat === 'FIVE_OPTIONS' ? ',"E) ..."' : ''}],"resposta_correta":"A","justificativa":"...","dificuldade":"Médio"}`;

  const compactAvoidQuestions = (avoidQuestions || batch?.previousQuestions || [])
    .map((question) => buildQuestionFingerprint(question))
    .filter(Boolean);
  const avoidInstruction = compactAvoidQuestions.length > 0
    ? '\n\nNÃO REPITA estes enunciados anteriores (resumos):\n' + compactAvoidQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') + '\nCrie questões diferentes em enunciado, abordagem e conteúdo.'
    : '';

  const objectivePlan = questionObjectives?.length
    ? `\nPLANO DE COBERTURA DO LOTE (uma questão diferente por linha):\n${questionObjectives.map((item) => {
      const pages = item.pageFrom ? `página${item.pageTo && item.pageTo !== item.pageFrom ? `s ${item.pageFrom}-${item.pageTo}` : ` ${item.pageFrom}`}` : 'trecho indicado';
      return `- ID ${item.id}: ${item.objective || 'conceito distinto'}; fonte: ${pages}.`;
    }).join('\n')}\nNão troque os objetivos entre IDs e não faça duas questões sobre a mesma regra.`
    : '';

  const objectiveInstruction = retrievalObjective
      ? `Nesta questão, avalie preferencialmente: ${retrievalObjective}.`
      : '';

  // Usa somente um trecho de estilo, sem respostas ou páginas fixas que possam
  // contaminar a fundamentação do material atual.
  const selectedExamples = fewShotExamples || selectFewShotExamples(focusTopics, domain, 1);
  const styleReference = selectedExamples[0]?.enunciado.slice(0, 320);
  const fewShotBlock = `Siga o formato ${schemaQuestion.replace('ID', String(startId))}. O conteúdo deve vir apenas das fontes fornecidas.${styleReference ? ` Estilo de enunciado (não copie o conteúdo): ${styleReference}` : ''}`;

  const systemPrompt = `Você é um especialista em elaboração de questões para concursos públicos (Carreiras Jurídicas, Fiscais, Policiais, Bancárias, Tribunais). Crie um simulado no nível solicitado, usando exclusivamente informações justificadamente relacionadas ao documento fornecido.

REGRAS OBRIGATÓRIAS:
- Retorne somente JSON puro, sem Markdown, comentários ou texto adicional.
- ${batchInstruction}
- ${formatInstruction}
- ${boardInstruction[examBoard]}
- ${difficultyInstruction}
- Não invente fatos, não repita questões e varie os conteúdos abordados.
- TODA JUSTIFICATIVA DEVE: (1) explicar a resposta correta, (2) explicar por que cada alternativa incorreta está errada, (3) citar explicitamente a página-fonte no formato "Página N".
- Seja conciso sem omitir a análise: enunciado com no máximo 700 caracteres, cada alternativa com no máximo 300 e justificativa com no máximo 1.000 caracteres, em um único parágrafo.
- Use somente os trechos de fonte apresentados no contexto desta chamada.
- Preencha "tema" com um rótulo curto e específico do assunto avaliado (máximo de 120 caracteres).
- Obedeça rigorosamente ao formato de resposta escolhido.
- EVITE: "múltipla escolha" (com acento), use "multipla_escolha".
- ${focusInstruction}
- ${objectiveInstruction}
${avoidInstruction}
${objectivePlan}

VALIDAÇÃO INTERNA (não inclua esta análise na saída): identifique a regra e a página, crie situação de aplicação, use distratores plausíveis e confira resposta, alternativas e fonte antes de emitir o JSON.

EXEMPLO DE FORMATO (ESTILO CONCURSO):
${fewShotBlock}

SCHEMA EXATO (${count} questão${count > 1 ? 'ões' : ''}):
${isBatch ? `{"titulo":"Título","questoes":[${schemaQuestion.replace('ID', String(startId))},...]}` : `{"titulo":"Título","total_questoes":${totalQuestions},"questoes":[${schemaQuestion.replace('ID', '1')}]}`}`;

    return {
      systemPrompt,
      userPrompt: `DOCUMENTO PARA ANÁLISE:\n\n${context}\n\nGere agora o JSON completo do lote.`,
    };
  }

