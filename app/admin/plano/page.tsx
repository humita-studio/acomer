import { db } from '@/shared/db';
import { ambientes, elementosPlano, mesas, restaurantes, sesionesMesa } from '@/shared/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ensureAmbientePorDefecto } from '@/features/mesas/plano-data';
import { PlanoManager } from './plano-manager';

export default async function PlanoPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  // Garantiza un ambiente por defecto y reubica mesas sin asignar
  await ensureAmbientePorDefecto(session.restauranteId);

  const [ambientesData, mesasData, elementosData, sesionesActivas] = await Promise.all([
    db
      .select()
      .from(ambientes)
      .where(and(eq(ambientes.restauranteId, session.restauranteId), isNull(ambientes.deletedAt)))
      .orderBy(asc(ambientes.orden), asc(ambientes.createdAt)),
    db
      .select()
      .from(mesas)
      .where(and(eq(mesas.restauranteId, session.restauranteId), isNull(mesas.deletedAt)))
      .orderBy(asc(mesas.createdAt)),
    db
      .select()
      .from(elementosPlano)
      .where(and(eq(elementosPlano.restauranteId, session.restauranteId), isNull(elementosPlano.deletedAt))),
    db
      .select({ mesaId: sesionesMesa.mesaId })
      .from(sesionesMesa)
      .where(and(eq(sesionesMesa.restauranteId, session.restauranteId), eq(sesionesMesa.estado, 'Activa'))),
  ]);

  const ocupadas = new Set(sesionesActivas.map((s) => s.mesaId));

  const mesasUI = mesasData.map((m) => ({
    id: m.id,
    identificador: m.identificador,
    qrToken: m.qrToken,
    parentMesaId: m.parentMesaId,
    ambienteId: m.ambienteId,
    posX: m.posX,
    posY: m.posY,
    ancho: m.ancho,
    alto: m.alto,
    forma: m.forma,
    capacidad: m.capacidad,
    rotacion: m.rotacion,
    ocupada: ocupadas.has(m.id),
  }));

  const ambientesUI = ambientesData.map((a) => ({ id: a.id, nombre: a.nombre, orden: a.orden }));

  const elementosUI = elementosData.map((e) => ({
    id: e.id,
    ambienteId: e.ambienteId,
    tipo: e.tipo,
    posX: e.posX,
    posY: e.posY,
    ancho: e.ancho,
    alto: e.alto,
    rotacion: e.rotacion,
    etiqueta: e.etiqueta,
  }));

  // Origin público (subdominio del tenant) para los QR de las mesas
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const [tenant] = await db
    .select({ slug: restaurantes.slug })
    .from(restaurantes)
    .where(eq(restaurantes.id, session.restauranteId))
    .limit(1);
  const tenantSlug = tenant?.slug || 'demo';
  const origin = host.includes('localhost')
    ? `http://${tenantSlug}.localhost:3000`
    : `https://${tenantSlug}.${host.replace('app.', '')}`;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Plano del local</h1>
      <PlanoManager
        ambientes={ambientesUI}
        mesas={mesasUI}
        elementos={elementosUI}
        origin={origin}
        userRole={session.role}
        tenantId={session.restauranteId}
      />
    </div>
  );
}
