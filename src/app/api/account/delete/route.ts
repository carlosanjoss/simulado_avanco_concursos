import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { verifyPassword, clearAuthCookie } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const schema = z.object({ password: z.string().min(1).max(200), confirmEmail: z.string().trim().email().max(254) })

export async function DELETE(request: NextRequest) {
  const session = await getAuthenticatedUser(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.confirmEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: 'Confirme exatamente o e-mail da conta' }, { status: 400 })
  }
  const account = await prisma.user.findUnique({ where: { id: session.id }, include: { subscription: true } })
  if (!account?.password || !await verifyPassword(parsed.data.password, account.password)) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 })
  }
  if (account.subscription?.status === 'ACTIVE') {
    return NextResponse.json({ error: 'Cancele a assinatura Pro pelo suporte antes de excluir definitivamente a conta.' }, { status: 409 })
  }
  if (account.isAdmin) {
    const activeAdmins = await prisma.user.count({ where: { isAdmin: true, accountStatus: 'ACTIVE' } })
    if (activeAdmins <= 1) return NextResponse.json({ error: 'Transfira a administração antes de excluir o último administrador.' }, { status: 409 })
  }

  const supabase = await getSupabaseAdmin()
  const { error } = await supabase.from('simulado_documents').delete().eq('user_id', account.id)
  if (error) {
    console.error('Falha ao excluir vetores da conta:', error.message)
    return NextResponse.json({ error: 'Não foi possível remover todos os dados temporários. Tente novamente.' }, { status: 503 })
  }
  await prisma.user.delete({ where: { id: account.id } })
  const response = NextResponse.json({ success: true })
  response.headers.set('Set-Cookie', clearAuthCookie())
  return response
}
