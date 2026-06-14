'use server';

import { db } from '@/shared/db';
import { ambientes, elementosPlano, mesas } from '@/shared/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { revalidatePath } from 'next/cache';

const TIPOS_ELEMENTO = ['pared', 'barra', 'contorno', 'decoracion'] as const;

function clampInt(value: unknown, min: number, fallback: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return n < min ? min : n;
}

function normalizarRotacion(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
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

    // Próximo orden = max(orden) + 1
    const [maxOrden] = await db
      .select({ max: sql<number>`COALESCE(MAX(${ambientes.orden}), -1)` })
      .from(ambientes)
      .where(and(eq(ambientes.restauranteId, session.restauranteId), isNull(ambientes.deletedAt)));

    const [creado] = await db
      .insert(ambientes)
      .values({
        restauranteId: session.restauranteId,
        nombre: limpio,
        orden: (maxOrden?.max ?? -1) + 1,
      })
      .returning();

    revalidatePath('/admin/plano');
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

    await db
      .update(ambientes)
      .set({ nombre: limpio })
      .where(and(eq(ambientes.id, id), eq(ambientes.restauranteId, session.restauranteId)));

    revalidatePath('/admin/plano');
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

    revalidatePath('/admin/plano');
    return { success: true };
  } catch (error) {
    console.error('[eliminarAmbiente]', error);
    return { success: false, message: 'Error al eliminar el ambiente' };
  }
}

// ============================================================================
// Mesas en el plano
// ============================================================================

export async function crearMesaEnPlano(ambienteId: string, identificador: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const limpio = (identificador || '').trim();
    if (!limpio) return { success: false, message: 'El identificador no puede estar vacío' };

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
        posX: 1,
        posY: 1,
        ancho: 2,
        alto: 2,
        forma: 'cuadrada',
        capacidad: 4,
        rotacion: 0,
      })
      .returning();

    revalidatePath('/admin/plano');
    revalidatePath('/admin/mesas');
    return { success: true, mesa: creada };
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

    await db
      .update(mesas)
      .set({ deletedAt: new Date() })
      .where(and(eq(mesas.id, mesaId), eq(mesas.restauranteId, session.restauranteId)));

    revalidatePath('/admin/plano');
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
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

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
        posX: clampInt(input.posX, 0, 0),
        posY: clampInt(input.posY, 0, 0),
        ancho: clampInt(input.ancho, 1, 1),
        alto: clampInt(input.alto, 1, 1),
        rotacion: normalizarRotacion(input.rotacion),
        etiqueta: input.etiqueta?.trim() || null,
      })
      .returning();

    revalidatePath('/admin/plano');
    return { success: true, elemento: creado };
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

    await db
      .update(elementosPlano)
      .set({ deletedAt: new Date() })
      .where(and(eq(elementosPlano.id, id), eq(elementosPlano.restauranteId, session.restauranteId)));

    revalidatePath('/admin/plano');
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

export async function guardarLayoutAction(payload: {
  mesas: MesaLayout[];
  elementos: ElementoLayout[];
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !hasPermission(session.role, 'canManageTables')) {
      return { success: false, message: 'No tenés permiso para gestionar el plano' };
    }

    const mesasPayload = payload.mesas ?? [];
    const elementosPayload = payload.elementos ?? [];

    await db.transaction(async (tx) => {
      for (const m of mesasPayload) {
        await tx
          .update(mesas)
          .set({
            ambienteId: m.ambienteId ?? null,
            posX: clampInt(m.posX, 0, 0),
            posY: clampInt(m.posY, 0, 0),
            ancho: clampInt(m.ancho, 1, 2),
            alto: clampInt(m.alto, 1, 2),
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
            posX: clampInt(el.posX, 0, 0),
            posY: clampInt(el.posY, 0, 0),
            ancho: clampInt(el.ancho, 1, 1),
            alto: clampInt(el.alto, 1, 1),
            rotacion: normalizarRotacion(el.rotacion),
            etiqueta: el.etiqueta?.trim() || null,
          })
          .where(and(eq(elementosPlano.id, el.id), eq(elementosPlano.restauranteId, session.restauranteId)));
      }
    });

    revalidatePath('/admin/plano');
    revalidatePath('/admin/mesas');
    return { success: true };
  } catch (error) {
    console.error('[guardarLayoutAction]', error);
    return { success: false, message: 'Error al guardar el plano' };
  }
}
