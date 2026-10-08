import { buildInviteUrl, getEmailTransport, isEmailConfigured, sendInviteEmail } from '../src/lib/email'
import { randomBytes } from 'node:crypto'

async function main() {
  const to = process.argv[2] || 'carlosdeemelo+beta@gmail.com'
  const token = randomBytes(24).toString('hex') // token de exemplo (não existe no banco)
  const inviteUrl = buildInviteUrl(token)

  console.log('transport:', getEmailTransport())
  console.log('configurado:', isEmailConfigured())
  console.log('from:', process.env.EMAIL_FROM || '(padrão)')
  console.log('para:', to)
  console.log('link:', inviteUrl)

  const result = await sendInviteEmail({ to, inviteUrl, name: 'Carlos' })
  console.log('resultado:', JSON.stringify(result))
  if (!result.sent) process.exit(1)
}

main()
