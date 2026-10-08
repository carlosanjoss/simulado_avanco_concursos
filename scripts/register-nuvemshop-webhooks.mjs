const storeId = process.env.NUVEMSHOP_STORE_ID
const token = process.env.NUVEMSHOP_ACCESS_TOKEN
const appId = process.env.NUVEMSHOP_APP_ID
const secret = process.env.NUVEMSHOP_WEBHOOK_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL
if (!storeId || !token || !appId || !secret || !appUrl) throw new Error('Configure NUVEMSHOP_STORE_ID, NUVEMSHOP_ACCESS_TOKEN, NUVEMSHOP_APP_ID, NUVEMSHOP_WEBHOOK_SECRET e NEXT_PUBLIC_APP_URL.')

const base = `https://api.nuvemshop.com/v1/${storeId}/webhooks`
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': `Avanco Simulados (${appId})`, 'Content-Type': 'application/json' }
const targetUrl = `${appUrl.replace(/\/$/, '')}/api/webhooks/nuvemshop`
const listResponse = await fetch(base, { headers })
if (!listResponse.ok) throw new Error(`Falha ao listar webhooks: HTTP ${listResponse.status}`)
const existing = await listResponse.json()
const alreadyRegistered = Array.isArray(existing) && existing.some((webhook) => webhook?.event === 'order/paid' && webhook?.url === targetUrl)
if (alreadyRegistered) {
  process.stdout.write(`Webhook order/paid já configurado em ${targetUrl}\n`)
  process.exit(0)
}
const response = await fetch(base, {
  method: 'POST',
  headers,
  body: JSON.stringify({ event: 'order/paid', url: targetUrl, headers: { 'X-Avanco-Webhook-Secret': secret } }),
})
if (!response.ok) throw new Error(`Falha ao criar webhook: HTTP ${response.status}`)
const webhook = await response.json()
process.stdout.write(`Webhook criado: ${webhook.id || 'sem id retornado'} (${targetUrl})\n`)
