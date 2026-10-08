import 'server-only'
import { Resend } from 'resend'
import nodemailer from 'nodemailer'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://avancositequestions.vercel.app'

// SMTP (funciona com Gmail usando senha de app, sem precisar de domínio próprio)
const SMTP_HOST = process.env.SMTP_HOST || (process.env.SMTP_USER ? 'smtp.gmail.com' : undefined)
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS

const EMAIL_FROM_DEFAULT = RESEND_API_KEY
  ? 'Avanço Simulados <onboarding@resend.dev>'
  : (SMTP_USER ? `Avanço Simulados <${SMTP_USER}>` : 'Avanço Simulados <nao-configurado@localhost>')
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_FROM_DEFAULT

export type EmailTransport = 'smtp' | 'resend' | 'none'

/** Prefere SMTP quando configurado (não exige domínio próprio). */
export function getEmailTransport(): EmailTransport {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return 'smtp'
  if (RESEND_API_KEY) return 'resend'
  return 'none'
}

export function isEmailConfigured(): boolean {
  return getEmailTransport() !== 'none'
}

let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY)
  return resendClient
}

let smtpTransport: ReturnType<typeof nodemailer.createTransport> | null = null
function getSmtp(): ReturnType<typeof nodemailer.createTransport> | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return smtpTransport
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildInviteEmail(inviteUrl: string, recipientName?: string) {
  const greeting = recipientName ? `Olá, ${escapeHtml(recipientName)}!` : 'Olá!'

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f8fd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fd;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#06183d;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Avanço Simulados</p>
          <p style="margin:6px 0 0;color:#ffc400;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Acesso liberado</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:17px;color:#06183d;font-weight:700;">${greeting}</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">
            Você foi convidado para testar o <strong>Avanço Simulados</strong> — a plataforma que transforma seus PDFs de estudo em simulados de 30 questões com correção e justificativa detalhada.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#334155;">
            Para começar, clique no botão abaixo e crie sua senha de acesso. O link é pessoal e expira em <strong>7 dias</strong>.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:12px;background:#1d4ed8;">
              <a href="${inviteUrl}" style="display:inline-block;padding:15px 30px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">Criar minha senha e entrar</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Se o botão não funcionar, copie e cole este link no navegador:</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#1d4ed8;word-break:break-all;">${inviteUrl}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
            Se você não esperava este convite, pode ignorar este e-mail com segurança.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 Avanço Simulados. Estude com inteligência.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `${greeting}

Você foi convidado para testar o Avanço Simulados.

Crie sua senha de acesso pelo link abaixo (expira em 7 dias):
${inviteUrl}

Se você não esperava este convite, ignore este e-mail.

© 2026 Avanço Simulados`

  return {
    subject: 'Seu convite para o Avanço Simulados',
    html,
    text,
  }
}

async function sendPreparedEmail(params: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean; error?: string; transport: EmailTransport }> {
  const transport = getEmailTransport()

  if (transport === 'none') {
    return { sent: false, error: 'EMAIL_NOT_CONFIGURED', transport }
  }

  if (transport === 'smtp') {
    const client = getSmtp()
    if (!client) return { sent: false, error: 'SMTP_NOT_CONFIGURED', transport }
    try {
      await client.sendMail({ from: EMAIL_FROM, to: params.to, subject: params.subject, html: params.html, text: params.text })
      return { sent: true, transport }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMTP_SEND_FAILED'
      console.error('Erro no envio por SMTP:', message)
      return { sent: false, error: message, transport }
    }
  }

  const resend = getResend()
  if (!resend) return { sent: false, error: 'EMAIL_NOT_CONFIGURED', transport }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    if (error) {
      console.error('Resend error:', error)
      return { sent: false, error: error.message || 'EMAIL_SEND_FAILED', transport }
    }
    return { sent: true, transport }
  } catch (error) {
    console.error('Erro ao enviar e-mail de convite:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'EMAIL_SEND_FAILED', transport }
  }
}

export async function sendInviteEmail(params: {
  to: string
  inviteUrl: string
  name?: string
}): Promise<{ sent: boolean; error?: string; transport: EmailTransport }> {
  return sendPreparedEmail({ to: params.to, ...buildInviteEmail(params.inviteUrl, params.name) })
}

function buildAccountActionEmail(params: { title: string; intro: string; button: string; url: string; expires: string }) {
  const safeUrl = escapeHtml(params.url)
  return {
    subject: `${params.title} — Avanço Simulados`,
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f8fd;font-family:Arial,sans-serif;color:#06183d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><tr><td style="background:#06183d;padding:26px 32px;color:#fff;font-size:20px;font-weight:800">Avanço Simulados</td></tr><tr><td style="padding:32px"><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(params.title)}</h1><p style="font-size:15px;line-height:1.6;color:#334155">${escapeHtml(params.intro)}</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">${escapeHtml(params.button)}</a></p><p style="font-size:13px;color:#64748b">Este link expira em ${escapeHtml(params.expires)}. Se você não solicitou esta ação, ignore o e-mail.</p><p style="font-size:12px;color:#1d4ed8;word-break:break-all">${safeUrl}</p></td></tr></table></td></tr></table></body></html>`,
    text: `${params.title}\n\n${params.intro}\n\n${params.url}\n\nEste link expira em ${params.expires}. Se você não solicitou esta ação, ignore o e-mail.`,
  }
}

export async function sendVerificationEmail(params: { to: string; token: string }) {
  const url = `${APP_URL.replace(/\/$/, '')}/verificar-email?token=${encodeURIComponent(params.token)}`
  return sendPreparedEmail({
    to: params.to,
    ...buildAccountActionEmail({ title: 'Confirme seu e-mail', intro: 'Confirme seu endereço de e-mail para ativar sua conta.', button: 'Confirmar e-mail', url, expires: '24 horas' }),
  })
}

export async function sendPasswordResetEmail(params: { to: string; token: string }) {
  const url = `${APP_URL.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(params.token)}`
  return sendPreparedEmail({
    to: params.to,
    ...buildAccountActionEmail({ title: 'Redefina sua senha', intro: 'Recebemos uma solicitação para criar uma nova senha para sua conta.', button: 'Criar nova senha', url, expires: '1 hora' }),
  })
}

export function buildInviteUrl(token: string, baseUrl?: string): string {
  const base = (baseUrl || APP_URL).replace(/\/$/, '')
  return `${base}/sign-up?token=${token}`
}
