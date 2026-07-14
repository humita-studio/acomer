import { db } from '@/shared/db';
import { ambientes, elementosPlano, mesas, sesionesMesa } from '@/shared/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';

/**
 * Forma de datos del plano que consume el editor (PlanoManager). Estructuralmente
 * compatible con AmbienteUI / MesaPlano / ElementoPlanoUI de plano-types.ts.
 */
export type PlanoData = {
  ambientes: { id: string; nombre: string; orden: number }[];
  mesas: {
    id: string;
    identificador: string;
    qrToken: string;
    parentMesaId: string | null;
    ambienteId: string | null;
    posX: number;
    posY: number;
    ancho: number;
    alto: number;
    forma: string;
    capacidad: number;
    rotacion: number;
    ocupada: boolean;
    /** auth.users id del mozo asignado, o null. */
    mozoUserId: string | null;
  }[];
  elementos: {
    id: string;
    ambienteId: string;
    tipo: string;
    posX: number;
    posY: number;
    ancho: number;
    alto: number;
    rotacion: number;
    etiqueta: string | null;
  }[];
};

/**
 * Lee el plano completo (ambientes + mesas con ocupación + elementos) ya mapeado
 * a la forma que usa el editor. Fuente única usada por el Server Component
 * (/admin/mesas) para `initialData` y por el action de lectura para refetch en
 * cliente (TanStack Query).
 */
export async function getPlanoData(restauranteId: string): Promise<PlanoData> {
  const [ambientesData, mesasData, elementosData, sesionesActivas] = await Promise.all([
    db
      .select()
      .from(ambientes)
      .where(and(eq(ambientes.restauranteId, restauranteId), isNull(ambientes.deletedAt)))
      .orderBy(asc(ambientes.orden), asc(ambientes.createdAt)),
    db
      .select()
      .from(mesas)
      .where(and(eq(mesas.restauranteId, restauranteId), isNull(mesas.deletedAt)))
      .orderBy(asc(mesas.createdAt)),
    db
      .select()
      .from(elementosPlano)
      .where(and(eq(elementosPlano.restauranteId, restauranteId), isNull(elementosPlano.deletedAt))),
    db
      .select({ mesaId: sesionesMesa.mesaId })
      .from(sesionesMesa)
      .where(and(eq(sesionesMesa.restauranteId, restauranteId), eq(sesionesMesa.estado, 'Activa'))),
  ]);

  const ocupadas = new Set(sesionesActivas.map((s) => s.mesaId));

  return {
    ambientes: ambientesData.map((a) => ({ id: a.id, nombre: a.nombre, orden: a.orden })),
    mesas: mesasData.map((m) => ({
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
      mozoUserId: m.mozoUserId ?? null,
    })),
    elementos: elementosData.map((e) => ({
      id: e.id,
      ambienteId: e.ambienteId,
      tipo: e.tipo,
      posX: e.posX,
      posY: e.posY,
      ancho: e.ancho,
      alto: e.alto,
      rotacion: e.rotacion,
      etiqueta: e.etiqueta,
    })),
  };
}

/**
 * Garantiza que el restaurante tenga al menos un ambiente y que ninguna mesa
 * quede sin asignar. Idempotente: se llama desde el loader de /admin/mesas.
 *
 * - Si no hay ningún ambiente, crea "Salón" (orden 0).
 * - Toda mesa con ambiente_id NULL se asigna al ambiente por defecto
 *   (el de menor orden), de modo que las mesas creadas desde /admin/mesas
 *   aparezcan automáticamente en el plano.
 */
export async function ensureAmbientePorDefecto(restauranteId: string): Promise<string> {
  const existentes = await db
    .select({ id: ambientes.id })
    .from(ambientes)
    .where(and(eq(ambientes.restauranteId, restauranteId), isNull(ambientes.deletedAt)))
    .orderBy(asc(ambientes.orden), asc(ambientes.createdAt));

  let defaultId: string;
  if (existentes.length === 0) {
    const [creado] = await db
      .insert(ambientes)
      .values({ restauranteId, nombre: 'Salón', orden: 0 })
      .returning({ id: ambientes.id });
    defaultId = creado.id;
  } else {
    defaultId = existentes[0].id;
  }

  // Reubicar mesas sin ambiente al ambiente por defecto
  await db
    .update(mesas)
    .set({ ambienteId: defaultId })
    .where(
      and(
        eq(mesas.restauranteId, restauranteId),
        isNull(mesas.ambienteId),
        isNull(mesas.deletedAt)
      )
    );

  return defaultId;
}
