# Avanço Simulados

Aplicação Next.js que transforma PDFs em simulados interativos de 30 questões, com RAG, evidências por página, correção, histórico e administração de usuários.

## Recursos principais

- autenticação própria por e-mail e senha, acesso por convite e cookies HTTP-only;
- dashboard administrativo com convites, busca, suspensão, papéis, revogação de sessões, reset de uso e exclusão de usuários;
- PDFs de até 20 MB e 400 páginas;
- processamento em lotes de cinco páginas e vetores temporários isolados por usuário no Supabase;
- 30 chamadas controladas à OpenRouter, recuperação seletiva de falhas e deduplicação;
- fontes por questão com página, trecho, chunk e similaridade;
- cota mensal transacional e rate limit distribuído opcional com Upstash;
- simulados, tentativas, banco de questões, matérias e planos de estudo.
- preparação comercial com preços, assinatura Nuvemshop/Nuvem Pago, verificação de e-mail e recuperação de senha;
- exportação e exclusão de conta, Termos de Uso e Política de Privacidade;
- Sentry, health check comercial, backup PostgreSQL e testes E2E com Playwright.

## Execução local

Requisitos: Node.js 20+, npm, PostgreSQL/Supabase e uma chave OpenRouter.

```powershell
npm install
Copy-Item .env.local.example .env.local
npm run db:supabase:migrate
npm run dev
```

Preencha as variáveis descritas em `.env.example`. `JWT_SECRET` deve ter pelo menos 32 caracteres. A primeira conta administrativa só pode ser criada com `ADMIN_BOOTSTRAP_TOKEN`:

Use `npm run env:prepare` para adicionar, sem sobrescrever, as variáveis locais ausentes. O guia completo de obtenção de cada credencial está em `docs/credential-setup.md`.

```text
http://localhost:3000/sign-up?bootstrap=SEU_TOKEN_TEMPORARIO
```

Depois da primeira conta, remova `ADMIN_BOOTSTRAP_TOKEN` do ambiente e use convites emitidos pelo dashboard.

## Banco e privacidade

Execute todas as migrations versionadas em `supabase/migrations` com:

```powershell
npm run db:supabase:migrate
npm run db:supabase:check
```

Use o transaction pooler em `DATABASE_URL` e uma conexão direta/session pooler em `DIRECT_URL` e `SUPABASE_DATABASE_URL`. O PDF original não é persistido. Para documentos extensos, texto e vetores ficam temporariamente no Supabase e são removidos após a expiração pelo cron `/api/cron/cleanup`.

## Rotas

- `/dashboard/novo` — upload e geração;
- `/dashboard/simulado/[id]` — resolução e resultado;
- `/dashboard/materias`, `/dashboard/questoes`, `/dashboard/planos` — estudo e organização;
- `/dashboard/perfil` — nome e senha;
- `/dashboard/admin/usuarios` — gerenciamento administrativo;
- `/precos` — comparação dos planos e checkout externo da Nuvemshop;
- `/termos`, `/privacidade` — documentos legais;
- `/esqueci-senha`, `/redefinir-senha`, `/verificar-email` — ciclo de segurança da conta;
- `/api/pdf-processing/*` — processamento vetorial em lotes;
- `/api/gerador`, `/api/resposta`, `/api/tentativa` — geração e execução dos simulados.

## Validação

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
npm run test:e2e
```

## Deploy na Vercel

1. Vincule o projeto à Vercel e configure as variáveis de `.env.example` em Production e Preview.
2. Defina `NEXT_PUBLIC_APP_URL` com o domínio final.
3. Configure `JWT_SECRET`, `CRON_SECRET` e, somente durante o bootstrap inicial, `ADMIN_BOOTSTRAP_TOKEN`.
4. Execute `npm run db:supabase:migrate` contra o banco de produção antes do deploy.
5. Faça o deploy e verifique `/api/health`, login, geração, feedback e gerenciamento de usuários.

## Preparação comercial

As instruções de Nuvemshop, monitoramento, backups e liberação estão em `docs/commercial-operations.md`. A integração concede o plano Pro somente após receber `order/paid`, consultar o pedido na API da Nuvemshop e relacionar o e-mail pago a uma conta existente.

Depois de configurar as credenciais e o domínio público, registre o webhook de pagamento com `npm run nuvemshop:webhooks`.
Antes da liberação comercial, execute `npm run commercial:check` para conferir se preços, URLs, contatos, monitoramento e credenciais obrigatórias foram preenchidos.

Antes da venda, configure preços, URLs e IDs dos produtos, valide os documentos legais com assessoria jurídica e habilite e-mail transacional, Sentry e backups externos.

Nunca versione `.env.local`, chaves, tokens, dados coletados ou caches de modelos.
