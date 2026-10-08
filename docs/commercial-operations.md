# Operação comercial

## Nuvemshop e Nuvem Pago

Referências oficiais: [assinaturas na Nuvemshop](https://atendimento.nuvemshop.com.br/pt_BR/venda-por-assinatura/como-vender-produto-por-assinatura-na-nuvemshop) e [API de webhooks](https://dev.nuvemshop.com.br/docs/erp-guide/orders/webhooks).

1. Ative o Nuvem Pago com cartão e o recurso de assinaturas na loja.
2. Cadastre os produtos digitais `Avanço Pro mensal` e `Avanço Pro anual`.
3. Use os SKUs `AVANCO_PRO_MONTHLY` e `AVANCO_PRO_ANNUAL`, ou configure os IDs nas variáveis de ambiente.
4. Preencha as variáveis `NUVEMSHOP_*`, defina `NEXT_PUBLIC_APP_URL` com o domínio público e execute `npm run nuvemshop:webhooks` para registrar `order/paid` com o cabeçalho secreto.
5. O comprador deve usar o mesmo e-mail da conta Avanço. O webhook consulta o pedido na API antes de conceder acesso.
6. Eventos são persistidos em `PaymentEvent`; o processamento possui trava idempotente para que pedidos repetidos ou simultâneos não estendam o plano duas vezes.

O cancelamento da assinatura ainda é realizado no painel da Nuvemshop. O suporte deve cancelar a recorrência e depois marcar a assinatura como cancelada em `/dashboard/admin/financeiro`. O acesso permanece válido até o fim do período já pago.

## Monitoramento

- Configure `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`. Mantenha `SENTRY_DEBUG=false` fora de uma investigação pontual.
- Monitore `/api/health` externamente a cada cinco minutos.
- Crie alertas para HTTP 5xx, falhas do webhook, latência de geração e aumento de custos.
- Não envie PDF, senha, token, resposta completa do modelo ou dados de cartão aos logs.

## Backup

- Ative os backups gerenciados e, quando disponível no plano, recuperação point-in-time do PostgreSQL/Supabase.
- Execute `npm run db:backup` em ambiente seguro com `pg_dump` instalado.
- Valide cada arquivo com `npm run db:backup:verify -- backups/ARQUIVO.dump`.
- Armazene cópias criptografadas fora da conta principal e teste uma restauração em staging trimestralmente.

## Checklist de liberação

- Preencher `.env.local` e executar `npm run commercial:check` para localizar variáveis ausentes ou provisórias.
- Aplicar migrations e executar `db:supabase:audit`.
- Registrar o webhook com `npm run nuvemshop:webhooks` e confirmar que ele aparece no painel/API da loja.
- Validar compra mensal, anual, renovação e evento duplicado.
- Validar recuperação de senha e verificação de e-mail.
- Executar testes unitários, E2E, lint, TypeScript, build e auditoria de dependências.
- Confirmar links, preços, e-mails de suporte e versões dos documentos legais.
