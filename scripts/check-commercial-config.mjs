const required = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
  'NEXT_PUBLIC_PRIVACY_EMAIL',
  'NUVEMSHOP_STORE_ID',
  'NUVEMSHOP_ACCESS_TOKEN',
  'NUVEMSHOP_APP_ID',
  'NUVEMSHOP_WEBHOOK_SECRET',
  'NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL',
  'NEXT_PUBLIC_PRO_MONTHLY_PRICE',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
]

const problems = []
for (const name of required) {
  const value = process.env[name]?.trim()
  if (!value || /replace|placeholder|a definir/i.test(value)) problems.push(`${name}: ausente ou provisório`)
}

for (const name of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL', 'NEXT_PUBLIC_NUVEMSHOP_PRO_ANNUAL_URL']) {
  const value = process.env[name]?.trim()
  if (value && !value.startsWith('https://')) problems.push(`${name}: deve usar HTTPS no ambiente comercial`)
}

if ((process.env.NUVEMSHOP_WEBHOOK_SECRET?.trim().length || 0) < 32) {
  problems.push('NUVEMSHOP_WEBHOOK_SECRET: use pelo menos 32 caracteres aleatórios')
}
if (process.env.PUBLIC_SIGNUP_ENABLED !== process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED) {
  problems.push('PUBLIC_SIGNUP_ENABLED e NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED devem ter o mesmo valor')
}
if (!process.env.NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID?.trim()) {
  process.stdout.write('Aviso: sem NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID; o produto deverá usar o SKU AVANCO_PRO_MONTHLY.\n')
}
if (process.env.NEXT_PUBLIC_NUVEMSHOP_PRO_ANNUAL_URL?.trim() && !process.env.NEXT_PUBLIC_PRO_ANNUAL_PRICE?.trim()) {
  problems.push('NEXT_PUBLIC_PRO_ANNUAL_PRICE: obrigatório quando o checkout anual estiver ativo')
}

if (problems.length) {
  process.stderr.write(`Configuração comercial incompleta:\n- ${problems.join('\n- ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('Configuração comercial pronta para validação operacional.\n')
}
