import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { getBillingViewAction } from '@/features/billing/billingActions';
import { BillingManager } from '@/features/billing/components/BillingManager';
import { Skeleton } from '@/shared/ui/skeleton';

function BillingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

async function BillingContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.role !== 'owner' && session.role !== 'admin') {
    redirect('/unauthorized');
  }

  const sp = await searchParams;
  const pagoState = typeof sp?.pago === 'string' ? sp.pago : undefined;
  const view = await getBillingViewAction();
  if (!view) redirect('/login');

  return <BillingManager initial={view} pagoState={pagoState} />;
}

export default function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent searchParams={searchParams} />
    </Suspense>
  );
}
