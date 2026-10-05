# Avanço Simulados

Aplicação SaaS que transforma PDFs em simulados interativos com 30 questões de múltipla escolha, feedback e histórico de desempenho.

## O que está implementado

- autenticação Clerk, landing page, dashboard, resolução e histórico;
- áreas de Matérias, Banco de Questões e Plano de Estudos semanal;
- PDF de até 20 MB e 400 páginas, validado por MIME, extensão e assinatura `%PDF-`;
- extração em memória com `pdfjs-dist`;
- divisão do texto em até 1.600 chunks e embeddings locais na CPU com `Xenova/all-MiniLM-L6-v2` (384 dimensões);
- processamento opcional de PDFs extensos no navegador em lotes idempotentes de 5 páginas, com busca vetorial isolada por usuário e documento no Supabase;
- RAG efêmero no modo local; no modo Supabase, texto e vetores expiram em 7 dias, enquanto as evidências essenciais ficam anexadas às questões;
- 30 chamadas individuais à OpenRouter, com no máximo 4 simultâneas;
- recuperação seletiva das chamadas que falharem e regeneração de questões duplicadas;
- exatamente 30 questões de múltipla escolha, validadas por Zod antes de salvar;
- cota mensal transacional de 2 gerações para contas gratuitas, com exceção configurável para desenvolvimento;
- gabarito protegido e pontuação recalculada no servidor;
- resultado detalhado por tipo, tema e dificuldade;
- navegação vertical das 30 questões no desktop e paleta responsiva em telas menores;
- testes unitários do pipeline, schema, concorrência, PDF, embeddings e cota.

## Stack

Next.js 14.2, React 18, TypeScript, Tailwind CSS, Clerk, Prisma, PostgreSQL/Supabase, pgvector, Zod, Vitest, PDF.js e Transformers.js.

## Execução local

Requisitos: Node.js 20+, npm, uma aplicação Clerk, uma chave OpenRouter e um projeto Supabase.

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:supabase:migrate
npm run dev
```

Configure `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL="postgresql://postgres.PROJECT_REF:SENHA@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT_REF:SENHA@POOLER_HOST:5432/postgres"
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash-0731
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
APP_TIMEZONE=America/Fortaleza

# Opcional, somente para testes locais sem cota mensal
CLERK_DEV_USER_EMAIL=
```

O MiniLM organiza e seleciona os trechos do PDF; a OpenRouter gera as questões. O modelo de embeddings é baixado no primeiro uso e permanece no cache local.

### PDFs extensos com Supabase

Crie um projeto Supabase e execute as migrations `001`, `002` e `003` da pasta
`supabase/migrations`. A terceira migration cria o banco principal da aplicação,
substituindo completamente o SQLite. Também é possível informar a connection
string real em `SUPABASE_DATABASE_URL` e rodar:

```bash
npm run db:supabase:migrate
npm run db:supabase:check
```

Use a URL do transaction pooler em `DATABASE_URL`, com `pgbouncer=true`, para a
aplicação na Vercel. Use a conexão direta ou o session pooler em `DIRECT_URL` e
`SUPABASE_DATABASE_URL` para tarefas administrativas e migrations.

Há duas formas de autenticação:

- recomendada: ative Clerk em `Authentication > Third-party auth` no Supabase e configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- administrativa: configure `SUPABASE_URL` com `SUPABASE_SECRET_KEY` (ou a chave legada `SUPABASE_SERVICE_ROLE_KEY`). A chave secreta é usada somente no servidor.

Quando configurado, o navegador extrai o texto página por página e envia lotes
de cinco páginas. Cada lote é vetorizado na CPU, salvo com número da página e
chave idempotente. Cada questão consulta uma região distinta, recupera até 20
candidatos e seleciona 8 fontes com diversidade de páginas. Os chunks expiram
em 7 dias e devem ser removidos periodicamente com
`delete_expired_simulado_documents()`.

## Fluxo de dados e privacidade

1. Sem Supabase, o PDF é validado e extraído durante a requisição; com Supabase, a extração acontece no navegador em lotes de cinco páginas.
2. O texto é dividido em chunks e vetorizado localmente na CPU do servidor.
3. Contextos distintos, distribuídos pelas páginas e por objetivos pedagógicos, são enviados à OpenRouter em 30 chamadas controladas.
4. Cada resposta é validada; falhas e duplicatas lexicais ou semânticas são refeitas seletivamente.
5. Páginas, trechos, IDs dos chunks e similaridade ficam anexados a cada questão para auditoria.
6. O PDF original e as respostas brutas do modelo não são armazenados. No modo Supabase, chunks e vetores são removidos pela rotina de expiração após 7 dias.

O suporte a até 400 páginas é um limite funcional. O tempo e o consumo de memória variam conforme a quantidade de texto do documento e a máquina que executa os embeddings.
Um PDF pode ser auditado sem enviá-lo à IA com
`npm run pdf:audit -- caminho/arquivo.pdf`.

## Qualidade

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Rotas principais

- `/dashboard/novo` — upload e geração;
- `/dashboard/materias` — organização dos temas identificados;
- `/dashboard/questoes` — pesquisa e filtros no banco pessoal de questões;
- `/dashboard/planos` — plano semanal persistido no navegador;
- `/dashboard/simulado/[id]` — resolução e resultado;
- `/api/pdf-processing/*` — sessão, lotes idempotentes e finalização no Supabase;
- `/api/gerador` — contexto vetorial → OpenRouter → PostgreSQL/Supabase;
- `/api/resposta` — correção autenticada;
- `/api/tentativa` — progresso e conclusão;
- `/api/usage` e `/api/providers` — cota e disponibilidade sem expor segredos.

## Publicação na Vercel

1. Importe o repositório na Vercel e mantenha o preset Next.js.
2. Cadastre as variáveis de `.env.example` nos ambientes Production e Preview.
3. Use o transaction pooler do Supabase em `DATABASE_URL` e o session pooler ou conexão direta em `DIRECT_URL`.
4. Defina `NEXT_PUBLIC_APP_URL` com o domínio final e cadastre esse mesmo domínio no Clerk.
5. Crie `CRON_SECRET` com um valor longo e aleatório. O cron diário de `vercel.json` remove documentos vetoriais expirados.
6. Antes do primeiro deploy, execute `npm run db:supabase:migrate` uma vez contra o projeto de produção.

As rotas de geração e processamento permitem até 300 segundos. Os lotes de cinco páginas reduzem o tamanho de cada requisição e os chunks permanecem temporariamente no Supabase. O cache do MiniLM usa `/tmp` na Vercel, porque o restante do sistema de arquivos da função não deve ser tratado como persistente. Para limitar requisições por IP entre múltiplas instâncias, ainda é recomendável substituir o rate limit em memória por Redis/Upstash; a cota mensal principal já é transacional no PostgreSQL.

Nunca versione `.env`, banco local, cache dos modelos ou chaves de API.
