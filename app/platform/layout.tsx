import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/features/platform/session';
import { PlatformShell } from '@/features/platform/components/PlatformShell';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformSession();

  if (!session) {
    redirect('/unauthorized');
  }

  return <PlatformShell email={session.user.email}>{children}</PlatformShell>;
}
