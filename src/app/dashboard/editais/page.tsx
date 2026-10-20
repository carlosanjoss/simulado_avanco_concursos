import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProFeatureNotice } from '@/components/billing/ProFeatureNotice'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import { getUserPlanAccess } from '@/lib/plan-access'
import ExamNoticesClient from './ExamNoticesClient'

export const dynamic = 'force-dynamic'

export default async function ExamNoticesPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  const access = await getUserPlanAccess(user)
  if (!access.examNotice) return <DashboardShell><ProFeatureNotice title="Leitor inteligente de edital" description="Transforme o conteúdo programático do edital em uma trilha de estudos conectada aos materiais, questões e desempenho." /></DashboardShell>
  return <DashboardShell><ExamNoticesClient /></DashboardShell>
}
