'use server';

import { db } from '@/shared/db';
import { ambientes, elementosPlano, mesas, sesionesMesa } from '@/shared/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath } from 'next/cache';
import { getPlanoData } from './plano-data';

const TIPOS_ELEMENTO = ['pared', 'barra', 'contorno', 'decoracion'] as const;

function clampInt(value: unknown, min: number, fallback: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return n < min ? min : n;
}

// Igual que clampInt pero conserva decimales (posiciones libres en el plano).
// Redondea a 2 decimales para evitar ruido de punto flotante.
function clampNum(value: unknown, min: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(n, min) * 100) / 100;
}

function normalizarRotacion(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

// ============================================================================
// Lectura del plano (para TanStack Query en cliente)
// ============================================================================

/**
 * Devuelve el plano completo del restaurante de la sesión. Lo usa el editor
 * (PlanoManager) como `queryFn` para refetchear tras invalidar (realtime de
 * ocupación, guardado, dividir/unir, liberar). Solo requiere sesión válida:
 * verla está permitido a todos los roles; editar se valida en cada mutación.
 */
export async function getPlanoDataAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { ambientes: [], mesas: [], elementos: [] };
  }
  return getPlanoData(session.restauranteId);
}

// ============================================================================
// Ambientes
// ============================================================================

export async function crearAmbiente(nombre: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const limpio = (nombre || '').trim();
    if (!limpio) return { success: false, message: 'El nombre no puede estar vacío' };

    const creado = await withTenant(claimsFromSession(session), async (db) => {
      // Próximo orden = max(orden) + 1
      const [maxOrden] = await db
        .select({ max: sql<number>`COALESCE(MAX(${ambientes.orden}), -1)` })
        .from(ambientes)
        .where(and(eq(ambientes.restauranteId, session.restauranteId), isNull(ambientes.deletedAt)));

      const [nuevo] = await db
        .insert(ambientes)
        .values({
          restauranteId: session.restauranteId,
          nombre: limpio,
          orden: (maxOrden?.max ?? -1) + 1,
        })
        .returning();
      return nuevo;
    });

    revalidatePath('/admin/mesas');
    return { success: true, ambiente: creado };
  } catch (error) {
    console.error('[crearAmbiente]', error);
    return { success: false, message: 'Error al crear el ambiente' };
  }
}

export async function renombrarAmbiente(id: string, nombre: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const limpio = (nombre || '').trim();
    if (!limpio) return { success: false, message: 'El nombre no puede estar vacío' };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(ambientes)
        .set({ nombre: limpio })
        .where(and(eq(ambientes.id, id), eq(ambientes.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/mesas');
    return { success: true };
  } catch (error) {
    console.error('[renombrarAmbiente]', error);
    return { success: false, message: 'Error al renombrar el ambiente' };
  }
}

export async function eliminarAmbiente(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      // No permitir borrar el último ambiente
      const activos = await db
        .select({ id: ambientes.id })
        .from(ambientes)
        .where(and(eq(ambientes.restauranteId, session.restauranteId), isNull(ambientes.deletedAt)));

      if (activos.length <= 1) {
        return { success: false, message: 'Tiene que quedar al menos un ambiente' };
      }

      await db.transaction(async (tx) => {
        // Las mesas del ambiente quedan sin asignar (se reubican al cargar el plano)
        await tx
          .update(mesas)
          .set({ ambienteId: null })
          .where(and(eq(mesas.ambienteId, id), eq(mesas.restauranteId, session.restauranteId)));

        // Los elementos del ambiente se borran (soft)
        await tx
          .update(elementosPlano)
          .set({ deletedAt: new Date() })
          .where(and(eq(elementosPlano.ambienteId, id), eq(elementosPlano.restauranteId, session.restauranteId)));

        await tx
          .update(ambientes)
          .set({ deletedAt: new Date() })
          .where(and(eq(ambientes.id, id), eq(ambientes.restauranteId, session.restauranteId)));
      });

      return { success: true };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[eliminarAmbiente]', error);
    return { success: false, message: 'Error al eliminar el ambiente' };
  }
}

// ============================================================================
// Mesas en el plano
// ============================================================================

export async function crearMesaEnPlano(
  ambienteId: string,
  identificador: string,
  layout?: {
    posX?: number;
    posY?: number;
    ancho?: number;
    alto?: number;
    forma?: string;
    capacidad?: number;
    rotacion?: number;
  },
): Promise<{ success: boolean; message?: string; mesa?: typeof mesas.$inferSelect }> {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const limpio = (identificador || '').trim();
    if (!limpio) return { success: false, message: 'El identificador no puede estar vacío' };

    const res = await withTenant(claimsFromSession(session), async (db) => {
      // Validar que el ambiente pertenece al restaurante
      const [amb] = await db
        .select({ id: ambientes.id })
        .from(ambientes)
        .where(and(eq(ambientes.id, ambienteId), eq(ambientes.restauranteId, session.restauranteId)))
        .limit(1);
      if (!amb) return { success: false, message: 'Ambiente inválido' };

      const [creada] = await db
        .insert(mesas)
        .values({
          restauranteId: session.restauranteId,
          identificador: limpio,
          ambienteId,
          posX: clampNum(layout?.posX, 0, 1),
          posY: clampNum(layout?.posY, 0, 1),
          ancho: clampNum(layout?.ancho, 0.5, 2),
          alto: clampNum(layout?.alto, 0.5, 2),
          forma: layout?.forma === 'redonda' ? 'redonda' : 'cuadrada',
          capacidad: clampInt(layout?.capacidad, 1, 4),
          rotacion: normalizarRotacion(layout?.rotacion ?? 0),
        })
        .returning();
      return { success: true, mesa: creada };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[crearMesaEnPlano]', error);
    return { success: false, message: 'Error al crear la mesa' };
  }
}

export async function eliminarMesaPlano(mesaId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(mesas)
        .set({ deletedAt: new Date() })
        .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/mesas');
    return { success: true };
  } catch (error) {
    console.error('[eliminarMesaPlano]', error);
    return { success: false, message: 'Error al eliminar la mesa' };
  }
}

// ============================================================================
// Elementos del plano (paredes / barra / contornos)
// ============================================================================

export async function crearElementoPlano(input: {
  ambienteId: string;
  tipo: string;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion?: number;
  etiqueta?: string | null;
}): Promise<{ success: boolean; message?: string; elemento?: typeof elementosPlano.$inferSelect }> {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [amb] = await db
        .select({ id: ambientes.id })
        .from(ambientes)
        .where(and(eq(ambientes.id, input.ambienteId), eq(ambientes.restauranteId, session.restauranteId)))
        .limit(1);
      if (!amb) return { success: false, message: 'Ambiente inválido' };

      const tipo = (TIPOS_ELEMENTO as readonly string[]).includes(input.tipo) ? input.tipo : 'pared';

      const [creado] = await db
        .insert(elementosPlano)
        .values({
          restauranteId: session.restauranteId,
          ambienteId: input.ambienteId,
          tipo,
          posX: clampNum(input.posX, 0, 0),
          posY: clampNum(input.posY, 0, 0),
          ancho: clampNum(input.ancho, 0.1, 1),
          alto: clampNum(input.alto, 0.1, 1),
          rotacion: normalizarRotacion(input.rotacion),
          etiqueta: input.etiqueta?.trim() || null,
        })
        .returning();
      return { success: true, elemento: creado };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[crearElementoPlano]', error);
    return { success: false, message: 'Error al crear el elemento' };
  }
}

export async function eliminarElementoPlano(id: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    await withTenant(claimsFromSession(session), (db) =>
      db
        .update(elementosPlano)
        .set({ deletedAt: new Date() })
        .where(and(eq(elementosPlano.id, id), eq(elementosPlano.restauranteId, session.restauranteId)))
    );

    revalidatePath('/admin/mesas');
    return { success: true };
  } catch (error) {
    console.error('[eliminarElementoPlano]', error);
    return { success: false, message: 'Error al eliminar el elemento' };
  }
}

// ============================================================================
// Guardado batch de la geometría (mesas + elementos)
// ============================================================================

export interface MesaLayout {
  id: string;
  ambienteId: string | null;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  forma: string;
  capacidad: number;
  rotacion: number;
}

export interface ElementoLayout {
  id: string;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion: number;
  etiqueta?: string | null;
}

export async function guardarLayoutAction(
  payload: {
    mesas: MesaLayout[];
    elementos: ElementoLayout[];
  },
  options?: {
    /** Por defecto true. En autosave del editor lo desactivamos para no invalidar RSC a cada drag. */
    revalidate?: boolean;
  },
) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const mesasPayload = payload.mesas ?? [];
    const elementosPayload = payload.elementos ?? [];

    await withTenant(claimsFromSession(session), (db) =>
      db.transaction(async (tx) => {
        for (const m of mesasPayload) {
          await tx
            .update(mesas)
            .set({
              ambienteId: m.ambienteId ?? null,
              posX: clampNum(m.posX, 0, 0),
              posY: clampNum(m.posY, 0, 0),
              ancho: clampNum(m.ancho, 0.5, 2),
              alto: clampNum(m.alto, 0.5, 2),
              forma: m.forma === 'redonda' ? 'redonda' : 'cuadrada',
              capacidad: clampInt(m.capacidad, 1, 4),
              rotacion: normalizarRotacion(m.rotacion),
            })
            .where(and(eq(mesas.id, m.id), eq(mesas.restauranteId, session.restauranteId)));
        }

        for (const el of elementosPayload) {
          await tx
            .update(elementosPlano)
            .set({
              posX: clampNum(el.posX, 0, 0),
              posY: clampNum(el.posY, 0, 0),
              ancho: clampNum(el.ancho, 0.1, 1),
              alto: clampNum(el.alto, 0.1, 1),
              rotacion: normalizarRotacion(el.rotacion),
              etiqueta: el.etiqueta?.trim() || null,
            })
            .where(and(eq(elementosPlano.id, el.id), eq(elementosPlano.restauranteId, session.restauranteId)));
        }
      })
    );

    if (options?.revalidate !== false) {
      revalidatePath('/admin/mesas');
    }
    return { success: true };
  } catch (error) {
    console.error('[guardarLayoutAction]', error);
    return { success: false, message: 'Error al guardar el plano' };
  }
}

// ============================================================================
// División de mesas (sub-mesas temporales)
// ============================================================================

async function tieneSesionActiva(mesaId: string) {
  const [activa] = await db
    .select({ id: sesionesMesa.id })
    .from(sesionesMesa)
    .where(and(eq(sesionesMesa.mesaId, mesaId), eq(sesionesMesa.estado, 'Activa')))
    .limit(1);
  return !!activa;
}

/**
 * Divide una mesa en una sub-mesa temporal con su propia cuenta/QR.
 * Ej: una mesa de 6 → queda en (6 - capacidadNueva) y se crea una sub-mesa
 * de `capacidadNueva` lugares. Sólo se permite sobre mesas libres y que no
 * sean ya una sub-mesa.
 */
export async function dividirMesaAction(
  mesaId: string,
  capacidadNueva: number
): Promise<{ success: boolean; message?: string; mesa?: typeof mesas.$inferSelect }> {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [mesa] = await db
        .select()
        .from(mesas)
        .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, session.restauranteId), isNull(mesas.deletedAt)))
        .limit(1);
      if (!mesa) return { success: false, message: 'Mesa no encontrada' };
      if (mesa.parentMesaId) return { success: false, message: 'Esta mesa ya es una sub-mesa' };

      const cap = Math.round(Number(capacidadNueva));
      if (!Number.isFinite(cap) || cap < 1 || cap >= mesa.capacidad) {
        return { success: false, message: `La sub-mesa debe tener entre 1 y ${mesa.capacidad - 1} lugares` };
      }

      if (await tieneSesionActiva(mesaId)) {
        return { success: false, message: 'No se puede dividir una mesa ocupada' };
      }

      // Letra del sufijo según sub-mesas existentes (B, C, D, ...)
      const hijos = await db
        .select({ id: mesas.id })
        .from(mesas)
        .where(and(eq(mesas.parentMesaId, mesaId), isNull(mesas.deletedAt)));
      const letra = String.fromCharCode(66 + hijos.length);

      const creada = await db.transaction(async (tx) => {
        await tx
          .update(mesas)
          .set({ capacidad: mesa.capacidad - cap })
          .where(eq(mesas.id, mesaId));

        const [hija] = await tx
          .insert(mesas)
          .values({
            restauranteId: session.restauranteId,
            identificador: `${mesa.identificador}-${letra}`,
            ambienteId: mesa.ambienteId,
            parentMesaId: mesaId,
            // La sub-mesa hereda el mozo del sector de la madre.
            mozoUserId: mesa.mozoUserId,
            posX: clampNum(mesa.posX + mesa.ancho + 0.3, 0, 0),
            posY: mesa.posY,
            ancho: 2,
            alto: 2,
            forma: mesa.forma,
            capacidad: cap,
            rotacion: 0,
          })
          .returning();
        return hija;
      });

      return { success: true, mesa: creada };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[dividirMesaAction]', error);
    return { success: false, message: 'Error al dividir la mesa' };
  }
}

/**
 * Vuelve a unir una sub-mesa con su mesa madre: devuelve la capacidad y elimina
 * la sub-mesa. Sólo si la sub-mesa está libre.
 */
export async function unirMesaAction(subMesaId: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const res = await withTenant(claimsFromSession(session), async (db) => {
      const [sub] = await db
        .select()
        .from(mesas)
        .where(and(eq(mesas.id, subMesaId), eq(mesas.restauranteId, session.restauranteId), isNull(mesas.deletedAt)))
        .limit(1);
      if (!sub) return { success: false, message: 'Sub-mesa no encontrada' };
      if (!sub.parentMesaId) return { success: false, message: 'Esta mesa no es una sub-mesa' };

      if (await tieneSesionActiva(subMesaId)) {
        return { success: false, message: 'No se puede unir una sub-mesa ocupada' };
      }

      await db.transaction(async (tx) => {
        // Devolver la capacidad a la madre (si sigue activa)
        const [madre] = await tx
          .select({ id: mesas.id, capacidad: mesas.capacidad })
          .from(mesas)
          .where(and(eq(mesas.id, sub.parentMesaId!), isNull(mesas.deletedAt)))
          .limit(1);
        if (madre) {
          await tx
            .update(mesas)
            .set({ capacidad: madre.capacidad + sub.capacidad })
            .where(eq(mesas.id, madre.id));
        }
        await tx.update(mesas).set({ deletedAt: new Date() }).where(eq(mesas.id, subMesaId));
      });

      return { success: true };
    });

    if (res.success) revalidatePath('/admin/mesas');
    return res;
  } catch (error) {
    console.error('[unirMesaAction]', error);
    return { success: false, message: 'Error al unir la mesa' };
  }
}
