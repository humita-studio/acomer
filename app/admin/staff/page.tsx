import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { StaffManager } from '@/features/auth/components/StaffManager';

export default async function StaffPage() {
  const session = await getCurrentSession();

  if (!session || !hasPermission(session.role as RoleType, 'canManageStaff')) {
    redirect('/unauthorized');
  }

  return (
    <StaffManager
      sessionRole={session.role as RoleType}
      sessionUserId={session.user.id}
    />
  );
}
