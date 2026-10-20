import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { prisma } from '@/lib/prisma'
import type { Question } from '@/types/quiz'
import QuestionBankClient from './QuestionBankClient'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { headers } from 'next/headers'
import { getUserPlanAccess } from '@/lib/plan-access'
import { ProFeatureNotice } from '@/components/billing/ProFeatureNotice'
import { questionSchema } from '@/lib/validations/quiz'

export const dynamic = 'force-dynamic'

export default async function QuestionBankPage() {
  // Ler token do cookie via headers
  const headersList = await headers()
  const cookie = headersList.get('cookie') || ''
  const user = await getAuthenticatedUserFromCookie(cookie)
  if (!user) redirect('/sign-in')
  const access = await getUserPlanAccess(user)
  if (!access.fullQuestionBank) return <DashboardShell><ProFeatureNotice title="Banco privado de questões" description="Pesquise, filtre e reutilize todas as questões geradas nos seus próprios simulados e materiais em um único lugar." /></DashboardShell>

  const simulados = await prisma.simulado.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, titulo: true, questoesJson: true, pdfNome: true, createdAt: true,
      materials: { select: { fileName: true } },
      questionBankEntries: {
        where: { userId: user.id },
        select: { questionId: true, favorite: true, tags: true, notes: true, excludedAt: true, editorialStatus: true, sourceType: true, sourceName: true, licenseReference: true, _count: { select: { versions: true } } },
      },
    },
  })

  const questions = simulados.flatMap((simulado) => {
    const metadata = new Map(simulado.questionBankEntries.map((entry) => [entry.questionId, entry]))
    return (JSON.parse(simulado.questoesJson) as Question[]).flatMap((raw) => {
      const parsed = questionSchema.safeParse(raw)
      if (!parsed.success) return []
      const question = parsed.data
      const entry = metadata.get(question.id)
      if (entry?.excludedAt) return []
      const materials = simulado.materials.map((item) => item.fileName)
      return [{
        key: `${simulado.id}-${question.id}`, simuladoId: simulado.id, simuladoTitulo: simulado.titulo, id: question.id,
        tema: question.tema?.trim() || simulado.titulo, enunciado: question.enunciado, opcoes: question.opcoes,
        respostaCorreta: question.resposta_correta, justificativa: question.justificativa, dificuldade: question.dificuldade,
        createdAt: simulado.createdAt.toISOString(), materials: materials.length ? materials : [simulado.pdfNome],
        favorite: entry?.favorite || false, tags: entry ? JSON.parse(entry.tags) as string[] : [], notes: entry?.notes || '',
        editorialStatus: entry?.editorialStatus || 'PRIVATE', sourceType: entry?.sourceType || 'USER_GENERATED',
        sourceName: entry?.sourceName || null, licenseReference: entry?.licenseReference || null, versionCount: entry?._count.versions || 0,
      }]
    })
  })

  return <DashboardShell><QuestionBankClient questions={questions} /></DashboardShell>
}
