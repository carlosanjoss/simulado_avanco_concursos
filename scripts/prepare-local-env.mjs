import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')
const examplePath = resolve(process.cwd(), '.env.local.example')

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) throw new Error('.env.local.example não encontrado')
  writeFileSync(envPath, readFileSync(examplePath, 'utf8'), { flag: 'wx' })
}

const original = readFileSync(envPath, 'utf8')
const lines = original.split(/\r?\n/)
const values = new Map()
for (const line of lines) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''))
}

function emailFrom(value = '') {
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/) || value.match(/([^\s<>]+@[^\s<>]+)/)
  return match?.[1] || ''
}

const contactEmail = values.get('NEXT_PUBLIC_SUPPORT_EMAIL')
  || values.get('SMTP_USER')
  || emailFrom(values.get('EMAIL_FROM'))

const generated = () => randomBytes(32).toString('base64url')
const defaults = new Map([
  ['ADMIN_BOOTSTRAP_TOKEN', generated()],
  ['PUBLIC_SIGNUP_ENABLED', 'false'],
  ['NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED', 'false'],
  ['NEXT_PUBLIC_SUPPORT_EMAIL', contactEmail || ''],
  ['NEXT_PUBLIC_PRIVACY_EMAIL', contactEmail || ''],
  ['NUVEMSHOP_STORE_ID', ''],
  ['NUVEMSHOP_ACCESS_TOKEN', ''],
  ['NUVEMSHOP_APP_ID', ''],
  ['NUVEMSHOP_WEBHOOK_SECRET', generated()],
  ['NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID', ''],
  ['NUVEMSHOP_PRO_ANNUAL_PRODUCT_ID', ''],
  ['NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL', ''],
  ['NEXT_PUBLIC_NUVEMSHOP_PRO_ANNUAL_URL', ''],
  ['NEXT_PUBLIC_PRO_MONTHLY_PRICE', ''],
  ['NEXT_PUBLIC_PRO_ANNUAL_PRICE', ''],
  ['PRO_MONTHLY_QUIZ_LIMIT', '30'],
  ['NEXT_PUBLIC_SENTRY_DSN', values.get('SENTRY_DSN') || ''],
  ['SENTRY_DEBUG', 'false'],
  ['SENTRY_ENABLE_DEV', 'false'],
  ['NEXT_PUBLIC_SENTRY_ENABLE_DEV', 'false'],
])

const added = []
for (const [name, value] of defaults) {
  if (values.has(name)) continue
  lines.push(`${name}=${value}`)
  values.set(name, value)
  added.push(name)
}

const normalized = `${lines.join('\n').replace(/\n+$/, '')}\n`
if (normalized !== original.replace(/\r\n/g, '\n')) writeFileSync(envPath, normalized, 'utf8')

const commercialMissing = [
  'NUVEMSHOP_STORE_ID',
  'NUVEMSHOP_ACCESS_TOKEN',
  'NUVEMSHOP_APP_ID',
  'NUVEMSHOP_PRO_MONTHLY_PRODUCT_ID',
  'NEXT_PUBLIC_NUVEMSHOP_PRO_MONTHLY_URL',
  'NEXT_PUBLIC_PRO_MONTHLY_PRICE',
].filter((name) => !values.get(name))

process.stdout.write(`Ambiente local preparado sem sobrescrever valores existentes. ${added.length} variável(is) adicionada(s).\n`)
if (commercialMissing.length) {
  process.stdout.write(`A aplicação pode iniciar em modo local. Para ativar vendas, preencha: ${commercialMissing.join(', ')}.\n`)
}
