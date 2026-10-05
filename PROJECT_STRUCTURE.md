# Estrutura do Avanço Simulados

```text
prisma/schema.prisma                     PostgreSQL/Supabase e modelos de domínio
public/images/                           identidade e ilustrações
src/app/page.tsx                         landing page
src/app/dashboard/                       dashboard, geração e resolução
src/app/dashboard/materias/              matérias extraídas dos simulados
src/app/dashboard/questoes/              banco pessoal com busca e filtros
src/app/dashboard/planos/                plano semanal interativo
src/app/api/gerador/route.ts             pipeline e recuperação da geração
src/app/api/pdf-processing/              sessões e lotes de páginas para Supabase
src/app/api/resposta/route.ts            correção autenticada
src/app/api/tentativa/route.ts           progresso e nota no servidor
src/app/api/usage/route.ts               cota mensal
src/app/api/cron/cleanup/route.ts         remoção agendada de vetores expirados
src/app/api/providers/route.ts           disponibilidade da OpenRouter
src/components/dashboard/DashboardShell  navegação autenticada
src/components/quiz/PerformanceBreakdown resultado por tipo, tema e dificuldade
src/lib/pdf-utils.ts                     validação e extração PDF.js
src/lib/embeddings.ts                    MiniLM local e vetorização
src/lib/document-vector-store.ts         persistência temporária e busca por documento
supabase/migrations/                     pgvector, tabelas, índices e RPC segura
src/lib/ai-providers.ts                  cliente OpenRouter
src/lib/question-generation.ts           concorrência e duplicidade
src/lib/prompts/quiz-generation.ts       contrato do prompt
src/lib/validations/quiz.ts              schema de múltipla escolha
src/lib/quiz-evaluation.ts               correção centralizada
src/lib/usage-limit.ts                   reserva transacional mensal
tests/                                   testes Vitest
```

## Fluxo

```text
PDF (20 MB / 400 páginas)
  → extração no navegador em lotes de 5 páginas (quando Supabase configurado)
  → chunks com página + embeddings MiniLM/CPU
  → armazenamento temporário e busca pgvector isolada por documento
  → 30 chamadas OpenRouter (concorrência máxima 4)
  → recuperação seletiva + remoção de duplicatas
  → Zod (30 questões de múltipla escolha)
  → PostgreSQL/Supabase (quiz, progresso e cota)
  → resolução e nota recalculada no servidor
```

Banco local, cache do modelo e variáveis secretas ficam fora do versionamento.
