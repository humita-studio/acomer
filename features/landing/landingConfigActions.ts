'use server';

import { db } from '@/shared/db';
import { landingConfig, restaurantes } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import {
  LANDING_CONFIG_DEFAULT,
  normalizarHora,
  type AccionesLanding,
  type ColorMarca,
  type HorarioDia,
  type LandingConfig,
  type RedesLanding,
} from './landingConfig';

const COLORES_VALIDOS: ColorMarca[] = ['terracota', 'ambar', 'verde'];

function parsearHorarios(raw: unknown): HorarioDia[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 7 }, (_, i) => {
    const o = (arr[i] ?? {}) as Record<string, unknown>;
    
    let turnos: { desde: string; hasta: string }[] = [];
    if (Array.isArray(o.turnos)) {
      turnos = o.turnos.map((t: any) => ({
        desde: normalizarHora(t?.desde) ?? '12:00',
        hasta: normalizarHora(t?.hasta) ?? '00:00',
      }));
    } else {
      // Compatibilidad con versión anterior (desde/hasta únicos)
      const desde = normalizarHora(o.desde) ?? LANDING_CONFIG_DEFAULT.horarios[i].turnos[0].desde;
      const hasta = normalizarHora(o.hasta) ?? LANDING_CONFIG_DEFAULT.horarios[i].turnos[0].hasta;
      turnos = [{ desde, hasta }];
    }

    return { cerrado: o.cerrado === true, turnos };
  });
}

function parsearAcciones(raw: unknown): AccionesLanding {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const flag = (k: keyof AccionesLanding) => (o[k] === undefined ? true : o[k] !== false);
  return {
    verCarta: flag('verCarta'),
    pedirOnline: flag('pedirOnline'),
    reservar: flag('reservar'),
    qr: flag('qr'),
  };
}

function parsearRedes(raw: unknown): RedesLanding {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (k: keyof RedesLanding) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return { whatsapp: str('whatsapp'), instagram: str('instagram'), telefono: str('telefono') };
}

/**
 * Lectura de la config de landing (sin auth): la usa la home pública del tenant
 * vía `db` (que bypassa RLS), igual que la carta. Devuelve los defaults si no
 * hay fila.
 */
export async function obtenerLandingConfig(tenantId: string): Promise<LandingConfig> {
  const [row] = await db
    .select()
    .from(landingConfig)
    .where(eq(landingConfig.restauranteId, tenantId))
    .limit(1);

  if (!row) return LANDING_CONFIG_DEFAULT;

  const color = row.colorMarca as ColorMarca;
  return {
    descripcion: row.descripcion ?? '',
    direccion: row.direccion ?? '',
    horarios: parsearHorarios(row.horarios),
    acciones: parsearAcciones(row.acciones),
    colorMarca: COLORES_VALIDOS.includes(color) ? color : 'terracota',
    redes: parsearRedes(row.redes),
  };
}

/** Admin: obtiene la config (o defaults) del restaurante en sesión. */
export async function getLandingConfigAction() {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      return { success: false, message: 'No autorizado', config: LANDING_CONFIG_DEFAULT };
    }
    const config = await obtenerLandingConfig(session.restauranteId);
    return { success: true, config };
  } catch (error) {
    console.error('[getLandingConfigAction]', error);
    return { success: false, message: 'Error al cargar la configuración', config: LANDING_CONFIG_DEFAULT };
  }
}

/** Sanea los horarios para persistir: rangos válidos o cae al default del día. */
function sanearHorarios(horarios: HorarioDia[]): HorarioDia[] {
  return Array.from({ length: 7 }, (_, i) => {
    const h = horarios?.[i];
    let turnos = h?.turnos;
    if (!Array.isArray(turnos) || turnos.length === 0) {
      turnos = [...LANDING_CONFIG_DEFAULT.horarios[i].turnos];
    } else {
      turnos = turnos.map(t => ({
        desde: normalizarHora(t?.desde) ?? '12:00',
        hasta: normalizarHora(t?.hasta) ?? '00:00',
      }));
    }
    return { cerrado: h?.cerrado === true, turnos };
  });
}

/** Admin: crea o actualiza la config de landing (upsert por restaurante). */
export async function guardarLandingConfigAction(datos: LandingConfig) {
  try {
    const session = await getCurrentSession();
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      return { success: false, message: 'No autorizado' };
    }

    const color: ColorMarca = COLORES_VALIDOS.includes(datos.colorMarca) ? datos.colorMarca : 'terracota';

    const valores = {
      restauranteId: session.restauranteId,
      descripcion: (datos.descripcion ?? '').trim().slice(0, 200),
      direccion: (datos.direccion ?? '').trim().slice(0, 200),
      horarios: sanearHorarios(datos.horarios),
      acciones: parsearAcciones(datos.acciones),
      colorMarca: color,
      redes: parsearRedes(datos.redes),
      updatedAt: new Date(),
    };

    await withTenant(claimsFromSession(session), (db) =>
      db
        .insert(landingConfig)
        .values(valores)
        .onConflictDoUpdate({
          target: landingConfig.restauranteId,
          set: {
            descripcion: valores.descripcion,
            direccion: valores.direccion,
            horarios: valores.horarios,
            acciones: valores.acciones,
            colorMarca: valores.colorMarca,
            redes: valores.redes,
            updatedAt: valores.updatedAt,
          },
        })
    );

    // Refrescar el admin y la home pública del local.
    revalidatePath('/admin/configuracion');
    const [rest] = await db
      .select({ slug: restaurantes.slug })
      .from(restaurantes)
      .where(eq(restaurantes.id, session.restauranteId))
      .limit(1);
    if (rest?.slug) revalidatePath(`/${rest.slug}`);

    return { success: true, message: 'Configuración guardada' };
  } catch (error) {
    console.error('[guardarLandingConfigAction]', error);
    return { success: false, message: 'No se pudo guardar la configuración' };
  }
}
