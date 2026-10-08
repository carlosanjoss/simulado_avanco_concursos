# Onde obter cada variável de ambiente

Nunca envie o conteúdo de `.env.local` por chat, commit ou captura de tela. No computador, use `.env.local`; na Vercel, cadastre os mesmos nomes em **Project > Settings > Environment Variables**, separando Development, Preview e Production.

## Variáveis locais geradas pelo projeto

Execute `npm run env:prepare`. O comando preserva tudo o que já existe e cria somente variáveis ausentes.

- `JWT_SECRET`: segredo de autenticação do Avanço. Gere com pelo menos 32 bytes aleatórios; não vem de serviço externo.
- `ADMIN_BOOTSTRAP_TOKEN`: token temporário para criar a primeira conta administrativa. Remova do ambiente depois do primeiro administrador.
- `CRON_SECRET`: segredo usado para proteger chamadas do cron.
- `NUVEMSHOP_WEBHOOK_SECRET`: segredo aleatório enviado como cabeçalho personalizado pela Nuvemshop.
- `APP_TIMEZONE`: use `America/Fortaleza`.
- `PUBLIC_SIGNUP_ENABLED` e `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED`: mantenha ambos iguais. Use `false` no beta e `true` quando abrir o cadastro público.
- `PRO_MONTHLY_QUIZ_LIMIT`: quantidade mensal do plano Pro; o padrão é `30`.

## Nuvemshop e Nuvem Pago

1. Crie ou acesse sua loja e ative o Nuvem Pago e a venda por assinatura.
2. Acesse o [Portal de Parceiros da Nuvemshop](https://partners.nuvemshop.com.br/) e crie um aplicativo para a sua loja.
3. O identificador do aplicativo preenche `NUVEMSHOP_APP_ID`.
4. Instale/autorize o aplicativo na loja. O fluxo OAuth devolve `access_token` e `user_id`: use o token em `NUVEMSHOP_ACCESS_TOKEN` e o `user_id` em `NUVEMSHOP_STORE_ID`.
5. Cadastre os produtos de assinatura. Use os SKUs `AVANCO_PRO_MONTHLY` e `AVANCO_PRO_ANNUAL`, ou copie seus IDs para `NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID` e `NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID`.
6. Copie as páginas públicas dos produtos para `NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL` e `NEXT_PUBLIC_NUVEMSHOP_PRO_ANNUAL_URL`.
7. Informe os valores exibidos ao cliente em `NEXT_PUBLIC_PRO_MONTHLY_PRICE` e `NEXT_PUBLIC_PRO_ANNUAL_PRICE`, por exemplo `29,90`.
8. Com a aplicação em um domínio HTTPS, execute `npm run nuvemshop:webhooks` para registrar o webhook `order/paid`.

Documentação oficial: [autenticação OAuth](https://dev.nuvemshop.com.br/docs/erp-guide/authentication), [webhooks](https://dev.nuvemshop.com.br/docs/erp-guide/orders/webhooks) e [assinaturas](https://atendimento.nuvemshop.com.br/pt_BR/venda-por-assinatura/como-vender-produto-por-assinatura-na-nuvemshop).

## Supabase e PostgreSQL

No projeto do [Supabase](https://supabase.com/dashboard):

- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_URL`: URL do projeto, disponível no diálogo **Connect** ou em **Project Settings**.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave **Publishable**. Ela pode ser usada no navegador, sempre protegida por RLS.
- `SUPABASE_SECRET_KEY`: chave **Secret**, exclusiva do servidor. Nunca use prefixo `NEXT_PUBLIC_` nela.
- `SUPABASE_SERVICE_ROLE_KEY`: compatibilidade com a chave legada `service_role`; deixe vazia quando `SUPABASE_SECRET_KEY` estiver configurada.
- `DATABASE_URL`: no diálogo **Connect**, escolha o pooler transacional para a aplicação/Vercel.
- `DIRECT_URL` e `SUPABASE_DATABASE_URL`: use conexão direta ou pooler de sessão para migrations, auditoria e backup.

## OpenRouter

Em [OpenRouter > API Keys](https://openrouter.ai/settings/keys), crie uma chave específica para o projeto e copie para `OPENROUTER_API_KEY`. Configure um limite de gastos na chave. `OPENROUTER_MODEL` recebe o identificador do modelo, no formato `autor/modelo`.

## E-mail transacional

O projeto aceita Resend ou SMTP; basta configurar um deles.

### Resend

1. Em [Resend > Domains](https://resend.com/domains), adicione um domínio ou subdomínio e publique os registros DNS solicitados.
2. Em [Resend > API Keys](https://resend.com/api-keys), crie uma chave com permissão apenas de envio e coloque em `RESEND_API_KEY`.
3. Defina `EMAIL_FROM` com um endereço do domínio verificado, por exemplo `Avanço Simulados <conta@emails.seudominio.com>`.

### SMTP

Use `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS`. Para Gmail, `SMTP_PASS` deve ser uma senha de aplicativo, não a senha comum da conta.

`NEXT_PUBLIC_SUPPORT_EMAIL` é o contato comercial mostrado no site. `NEXT_PUBLIC_PRIVACY_EMAIL` é o canal para solicitações de privacidade; podem apontar para o mesmo endereço inicialmente.

## Upstash Redis

No [console da Upstash](https://console.upstash.com/), crie um banco Redis, abra **Details/Connect > REST** e copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. Essas variáveis mantêm o rate limit consistente entre instâncias serverless.

## Sentry

Crie um projeto Next.js no [Sentry](https://sentry.io/), abra **Project Settings > Client Keys (DSN)** e copie o DSN para `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`. O DSN identifica o projeto; os tokens administrativos do Sentry não são necessários para executar a aplicação. Mantenha `SENTRY_DEBUG=false`. Por padrão, `SENTRY_ENABLE_DEV=false` e `NEXT_PUBLIC_SENTRY_ENABLE_DEV=false` evitam enviar erros locais; altere ambos somente durante uma investigação.

## URLs e Vercel

- `NEXT_PUBLIC_APP_URL`: `http://localhost:3000` no desenvolvimento e o domínio HTTPS definitivo em produção.
- `CRON_SECRET`, chaves Secret do Supabase, tokens Nuvemshop, Redis, OpenRouter e Resend devem existir somente no servidor.
- Na Vercel, abra **Project > Settings > Environment Variables**, cole os valores e faça um novo deploy para que alterações sejam aplicadas.

## Conferência final

O desenvolvimento local pode iniciar sem Nuvemshop, Sentry público ou checkout. Esses recursos aparecerão como não configurados até você preencher as variáveis.

```powershell
npm run env:prepare
npm run dev
```

Antes de vender:

```powershell
npm run commercial:check
npm run nuvemshop:webhooks
```
