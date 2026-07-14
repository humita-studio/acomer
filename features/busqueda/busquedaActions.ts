'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  canAccessSection,
  hasPermission,
  type RoleType,
} from '@/features/authorization/roles';
import { claimsFromSession, getCurrentSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import {
  datosEntrega,
  mesas,
  sesionesMesa,
} from '@/shared/db/schema';

/** Minúsculas + sin tildes, para que "jose" encuentre "José". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export type BusquedaHit = {
  kind: 'mesa' | 'pedido';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const MAX_HITS = 10;
const MAX_SCAN_PEDIDOS = 100;

const ESTADO_ENTREGA_LABEL: Record<string, string> = {
  Recibido: 'Recibido',
  EnPreparacion: 'En preparación',
  Listo: 'Listo',
  EnCamino: 'En camino',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
};

/**
 * Búsqueda global del panel admin: mesas (por identificador) y pedidos online
 * (por nombre, teléfono o dirección). Respeta permisos del rol.
 */
export async function buscarAdminAction(queryRaw: string): Promise<{
  success: boolean;
  results: BusquedaHit[];
  message?: string;
}> {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { success: false, results: [], message: 'No autenticado' };
    }

    const q = queryRaw.trim();
    if (q.length < 1 || q.length > 80) {
      return { success: true, results: [] };
    }

    const qNorm = normalizar(q);
    const role = session.role as RoleType;
    const canTables = canAccessSection(role, 'tables');
    const canDelivery = canAccessSection(role, 'delivery');
    const canOpenMesa = hasPermission(role, 'canTakeOrders');

    if (!canTables && !canDelivery) {
      return { success: true, results: [] };
    }

    const results = await withTenant(claimsFromSession(session), async (db) => {
      const hits: BusquedaHit[] = [];

      if (canTables) {
        const [mesasRows, sesionesActivas] = await Promise.all([
          db
            .select({
              id: mesas.id,
              identificador: mesas.identificador,
            })
            .from(mesas)
            .where(
              and(
                eq(mesas.restauranteId, session.restauranteId),
                isNull(mesas.deletedAt),
              ),
            ),
          db
            .select({ mesaId: sesionesMesa.mesaId })
            .from(sesionesMesa)
            .where(
              and(
                eq(sesionesMesa.restauranteId, session.restauranteId),
                eq(sesionesMesa.estado, 'Activa'),
              ),
            ),
        ]);

        const ocupadas = new Set(
          sesionesActivas.map((s) => s.mesaId).filter(Boolean) as string[],
        );

        const mesasMatch = mesasRows
          .filter((m) => normalizar(m.identificador).includes(qNorm))
          // Mesas ocupadas primero; luego alfabético por etiqueta.
          .sort((a, b) => {
            const ao = ocupadas.has(a.id) ? 0 : 1;
            const bo = ocupadas.has(b.id) ? 0 : 1;
            if (ao !== bo) return ao - bo;
            return a.identificador.localeCompare(b.identificador, 'es');
          })
          .slice(0, MAX_HITS);

        for (const m of mesasMatch) {
          const ocupada = ocupadas.has(m.id);
          hits.push({
            kind: 'mesa',
            id: m.id,
            title: m.identificador,
            subtitle: ocupada ? 'Ocupada' : 'Libre',
            href:
              canOpenMesa && ocupada
                ? `/admin/mesas?pedido=${encodeURIComponent(m.id)}`
                : '/admin/mesas',
          });
        }
      }

      if (canDelivery && hits.length < MAX_HITS) {
        const ordenes = await db
          .select({
            sesionMesaId: sesionesMesa.id,
            tipo: sesionesMesa.tipo,
            nombreContacto: datosEntrega.nombreContacto,
            telefono: datosEntrega.telefono,
            direccion: datosEntrega.direccion,
            estadoEntrega: datosEntrega.estadoEntrega,
            createdAt: datosEntrega.createdAt,
          })
          .from(datosEntrega)
          .innerJoin(
            sesionesMesa,
            eq(datosEntrega.sesionMesaId, sesionesMesa.id),
          )
          .where(eq(datosEntrega.restauranteId, session.restauranteId))
          .orderBy(desc(datosEntrega.createdAt))
          .limit(MAX_SCAN_PEDIDOS);

        const tipoKeyword = (tipo: string) => {
          if (tipo === 'delivery') return 'envio delivery';
          if (tipo === 'takeaway') return 'retiro takeaway';
          return tipo;
        };

        const pedidosMatch = ordenes
          .filter((o) => {
            const haystack = normalizar(
              [
                o.nombreContacto,
                o.telefono,
                o.direccion ?? '',
                tipoKeyword(o.tipo),
                ESTADO_ENTREGA_LABEL[o.estadoEntrega] ?? o.estadoEntrega,
              ].join(' '),
            );
            return haystack.includes(qNorm);
          })
          .slice(0, MAX_HITS - hits.length);

        for (const o of pedidosMatch) {
          const modo =
            o.tipo === 'delivery'
              ? 'Envío'
              : o.tipo === 'takeaway'
                ? 'Retiro'
                : o.tipo;
          const estado =
            ESTADO_ENTREGA_LABEL[o.estadoEntrega] ?? o.estadoEntrega;
          hits.push({
            kind: 'pedido',
            id: o.sesionMesaId,
            title: o.nombreContacto,
            subtitle: `${modo} · ${estado} · ${o.telefono}`,
            href: `/admin/pedidos-online?sesion=${encodeURIComponent(o.sesionMesaId)}`,
          });
        }
      }

      return hits;
    });

    return { success: true, results };
  } catch (error) {
    console.error('[buscarAdminAction]', error);
    return {
      success: false,
      results: [],
      message: 'Error al buscar',
    };
  }
}
