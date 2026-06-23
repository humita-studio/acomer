import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReservasDelDiaAction } from '@/features/reservas/reservasActions';
import { getReservasConfigAction } from '@/features/reservas/reservasConfigActions';
import { ReservasManager } from '@/features/reservas/components/ReservasManager';
import { Skeleton } from '@/shared/ui/skeleton';

function fechaHoyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ReservasSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar area */}
        <Skeleton className="h-72 w-full rounded-xl" />
        {/* Sidebar with reservations list */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function ReservasContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!canAccessSection(session.role, 'reservas')) redirect('/unauthorized');

  const sp = await searchParams;
  const fecha = typeof sp?.fecha === 'string' ? sp.fecha : fechaHoyLocal();

  // Mes visible derivado del día seleccionado: [1° 00:00, 1° del mes siguiente).
  const [anio, mesNum] = fecha.split('-').map(Number);
  const mesIni = new Date(anio, mesNum - 1, 1);
  const mesFin = new Date(anio, mesNum, 1);
  const mesKey = `${anio}-${String(mesNum).padStart(2, '0')}`;

  const [reservasRes, configRes] = await Promise.all([
    getReservasDelDiaAction(mesIni.toISOString(), mesFin.toISOString()),
    getReservasConfigAction(),
  ]);

  const reservas = reservasRes.success ? reservasRes.reservas : [];

  return (
    <ReservasManager
      tenantId={session.restauranteId}
      fecha={fecha}
      mesKey={mesKey}
      desdeISO={mesIni.toISOString()}
      hastaISO={mesFin.toISOString()}
      initialReservas={reservas as never}
      config={configRes.config}
    />
  );
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<ReservasSkeleton />}>
      <ReservasContent searchParams={searchParams} />
    </Suspense>
  );
}
