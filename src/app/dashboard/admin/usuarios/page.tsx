import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getAuthenticatedUserFromCookie } from '@/lib/server-auth'
import AdminUsersClient from './AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const user = await getAuthenticatedUserFromCookie((await headers()).get('cookie'))
  if (!user) redirect('/sign-in')
  if (!user.isAdmin) redirect('/dashboard')

  return <DashboardShell><AdminUsersClient /></DashboardShell>
}
