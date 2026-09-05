import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { StaffManager } from '@/features/auth/components/StaffManager';
import { Skeleton } from '@/shared/ui/skeleton';

function StaffSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function StaffContent() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role as RoleType, 'canManageStaff')) redirect('/unauthorized');

  return (
    <StaffManager
      sessionRole={session.role as RoleType}
      sessionUserId={session.user.id}
    />
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffContent />
    </Suspense>
  );
}
