import { redirect } from 'next/navigation';
import { db } from '@/shared/db';
import { mesas } from '@/shared/db/schema';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { canAccessSection } from '@/features/authorization/roles';
import { getReservasDelDiaAction } from '@/features/reservas/reservas-actions';
import { getReservasConfigAction } from '@/features/reservas/reservas-config-actions';
import { ReservasManager } from './reservas-manager';

function fechaHoyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function ReservasPage({
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

  const [reservasRes, mesasList, configRes] = await Promise.all([
    getReservasDelDiaAction(mesIni.toISOString(), mesFin.toISOString()),
    db
      .select({ id: mesas.id, identificador: mesas.identificador, capacidad: mesas.capacidad })
      .from(mesas)
      .where(
        and(
          eq(mesas.restauranteId, session.restauranteId),
          isNull(mesas.deletedAt),
          isNull(mesas.parentMesaId),
        ),
      )
      .orderBy(asc(mesas.identificador)),
    getReservasConfigAction(),
  ]);

  const reservas = reservasRes.success ? reservasRes.reservas : [];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservas</h1>
          <p className="text-gray-500">
            Elegí un día en el calendario para ver y gestionar su agenda. “Sentar” a un comensal ocupa
            la mesa en el plano automáticamente.
          </p>
        </div>
        <a
          href="/admin/reservas/configuracion"
          className="shrink-0 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium"
        >
          ⚙️ Configuración
        </a>
      </div>

      <ReservasManager
        tenantId={session.restauranteId}
        fecha={fecha}
        mesKey={mesKey}
        desdeISO={mesIni.toISOString()}
        hastaISO={mesFin.toISOString()}
        initialReservas={reservas as never}
        mesas={mesasList}
        config={configRes.config}
      />
    </div>
  );
}
