'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { mesas, productos } from '@/shared/db/schema';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import type { OnboardingStatus, OnboardingStepStatus } from './onboarding';
import { requiredStepIds } from './onboarding';

/**
 * Estado del checklist de primer día del local.
 * Solo owners/admins (quien puede configurar el local).
 * Los counts se scopean siempre por restauranteId de la sesión.
 */
export async function getOnboardingStatusAction(): Promise<OnboardingStatus | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (!hasPermission(session.role, 'canManageSettings')) return null;

  const tenantId = session.restauranteId;

  try {
    const [productosRow, mesasRow, pagosRow, landingRow, restRow] = await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(productos)
        .where(
          and(
            eq(productos.restauranteId, tenantId),
            isNull(productos.deletedAt),
            eq(productos.activo, true),
          ),
        ),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(mesas)
        .where(
          and(
            eq(mesas.restauranteId, tenantId),
            isNull(mesas.deletedAt),
            isNull(mesas.parentMesaId),
          ),
        ),
      db.query.configuracionPagos.findFirst({
        where: (t, { eq: e }) => e(t.restauranteId, tenantId),
        columns: { proveedor: true, activo: true, credenciales: true },
      }),
      db.query.landingConfig.findFirst({
        where: (t, { eq: e }) => e(t.restauranteId, tenantId),
        columns: {
          descripcion: true,
          direccion: true,
          imagenUrl: true,
          redes: true,
        },
      }),
      db.query.restaurantes.findFirst({
        where: (t, { eq: e }) => e(t.id, tenantId),
        columns: { slug: true },
      }),
    ]);

    const nProductos = Number(productosRow[0]?.c ?? 0);
    const nMesas = Number(mesasRow[0]?.c ?? 0);

    const creds = (pagosRow?.credenciales ?? {}) as { access_token?: string };
    const tieneToken = typeof creds.access_token === 'string' && creds.access_token.length > 0;
    const mpVinculado =
      !!pagosRow?.activo &&
      tieneToken &&
      (pagosRow.proveedor === 'mercado_pago_oauth' ||
        pagosRow.proveedor === 'mercado_pago');

    const redes = (landingRow?.redes ?? {}) as {
      whatsapp?: string;
      instagram?: string;
      telefono?: string;
    };
    const tieneRed =
      !!(redes.whatsapp?.trim() || redes.instagram?.trim() || redes.telefono?.trim());
    const landingHecha = !!(
      landingRow &&
      (landingRow.descripcion.trim() ||
        landingRow.direccion.trim() ||
        landingRow.imagenUrl.trim() ||
        tieneRed)
    );

    const steps: OnboardingStepStatus[] = [
      {
        id: 'menu',
        done: nProductos >= 1,
        detalle:
          nProductos === 0
            ? undefined
            : nProductos === 1
              ? '1 producto'
              : `${nProductos} productos`,
      },
      {
        id: 'mesas',
        done: nMesas >= 1,
        detalle:
          nMesas === 0 ? undefined : nMesas === 1 ? '1 mesa' : `${nMesas} mesas`,
      },
      {
        id: 'pagos',
        done: mpVinculado,
        detalle: mpVinculado ? 'Mercado Pago vinculado' : undefined,
      },
      {
        id: 'landing',
        done: landingHecha,
        detalle: landingHecha ? 'Página personalizada' : undefined,
      },
    ];

    const required = new Set(requiredStepIds());
    const hechos = steps.filter((s) => required.has(s.id) && s.done).length;
    const total = required.size;

    return {
      steps,
      hechos,
      total,
      listo: hechos >= total,
      slug: restRow?.slug ?? session.slugRestaurante,
    };
  } catch (error) {
    console.error('[getOnboardingStatusAction]', error);
    return null;
  }
}
