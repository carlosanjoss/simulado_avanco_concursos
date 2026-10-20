const storeId = process.env.NUVEMSHOP_STORE_ID
const token = process.env.NUVEMSHOP_ACCESS_TOKEN
const secret = process.env.NUVEMSHOP_WEBHOOK_SECRET
const appSecret = process.env.NUVEMSHOP_APP_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL
const identity = process.env.NUVEMSHOP_APP_ID || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'integracao-propria'
const userAgent = process.env.NUVEMSHOP_USER_AGENT || `Avanco Simulados (${identity})`
const apiBaseUrl = (process.env.NUVEMSHOP_API_BASE_URL || 'https://api.nuvemshop.com.br/v1').replace(/\/$/, '')
if (!storeId || !token || !secret || !appSecret || !appUrl) throw new Error('Configure NUVEMSHOP_STORE_ID, NUVEMSHOP_ACCESS_TOKEN, NUVEMSHOP_APP_SECRET, NUVEMSHOP_WEBHOOK_SECRET e NEXT_PUBLIC_APP_URL.')
if (!appUrl.startsWith('https://') || /localhost|127\.0\.0\.1/i.test(appUrl)) throw new Error('NEXT_PUBLIC_APP_URL deve ser um domínio HTTPS público para registrar o webhook.')

const base = `${apiBaseUrl}/${storeId}/webhooks`
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': userAgent, 'Content-Type': 'application/json' }
const targetUrl = `${appUrl.replace(/\/$/, '')}/api/webhooks/nuvemshop`
const listResponse = await fetch(base, { headers })
if (!listResponse.ok) throw new Error(`Falha ao listar webhooks: HTTP ${listResponse.status}`)
const existing = await listResponse.json()
const events = ['order/paid', 'order/cancelled', 'order/voided']
for (const event of events) {
  const registered = Array.isArray(existing) && existing.find((webhook) => webhook?.event === event && webhook?.url === targetUrl)
  const body = JSON.stringify({ event, url: targetUrl, headers: { 'X-Avanco-Webhook-Secret': secret } })
  if (registered) {
    const updateResponse = await fetch(`${base}/${registered.id}`, { method: 'PUT', headers, body })
    if (!updateResponse.ok) throw new Error(`Falha ao atualizar webhook ${event}: HTTP ${updateResponse.status}`)
    process.stdout.write(`Webhook ${event} atualizado em ${targetUrl}\n`)
    continue
  }
  const response = await fetch(base, { method: 'POST', headers, body })
  if (!response.ok) throw new Error(`Falha ao criar webhook ${event}: HTTP ${response.status}`)
  const webhook = await response.json()
  process.stdout.write(`Webhook ${event} criado: ${webhook.id || 'sem id retornado'} (${targetUrl})\n`)
}
