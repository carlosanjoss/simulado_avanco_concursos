import { UserProfile } from '@clerk/nextjs';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default function ProfilePage() {
  return (
    <DashboardShell>
      <div className="p-5 sm:p-8 pb-28 flex justify-center">
        <UserProfile routing="path" path="/dashboard/perfil" />
      </div>
    </DashboardShell>
  );
}
