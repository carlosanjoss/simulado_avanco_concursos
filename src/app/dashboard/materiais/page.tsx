import DashboardShell from '@/components/dashboard/DashboardShell'
import MaterialsClient from './MaterialsClient'

export const dynamic = 'force-dynamic'

export default function MaterialsPage() {
  return <DashboardShell><MaterialsClient /></DashboardShell>
}
