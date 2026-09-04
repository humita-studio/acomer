'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/shared/db';
import { configuracionResenas, resenasClientes } from '@/shared/db/schema';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { getTenantBySlug } from '@/features/tenant/get-tenant';
import { crearStaffAlert } from '@/features/notificaciones/staffAlertsActions';
import { calcularMetricasResenas, esDerivableAGoogle } from './resenasCore';
import type {
  ConfiguracionResenasDto,
  EnviarFeedbackInput,
  EnviarFeedbackResult,
  EstadoResena,
  ResenaClienteDto,
  ResenasMetricsDto,
} from './types';

/**
 * Envío de calificación y feedback desde el comensal (público / mesa / delivery / directo).
 * No requiere login de empleado.
 */
export async function enviarFeedbackAction(
  input: EnviarFeedbackInput,
): Promise<EnviarFeedbackResult> {
  const { rateLimit } = await import('@/shared/lib/rateLimit');
  const { getClientIp } = await import('@/shared/lib/clientIp');
  const ip = await getClientIp();
  const rl = rateLimit(`resena:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return { success: false, message: rl.message, derivadaAGoogle: false };
  }

  const slug = (input.slug ?? '').trim().toLowerCase();
  if (!slug) {
    return { success: false, message: 'Falta el local', derivadaAGoogle: false };
  }

  const tenantId = await getTenantBySlug(slug);
  if (!tenantId) {
    return { success: false, message: 'Local no encontrado', derivadaAGoogle: false };
  }
  const estrellas = Math.min(5, Math.max(1, Math.round(Number(input.estrellas) || 5)));

  try {
    // 1. Obtener configuración de reseñas del local
    const configRow = await db.query.configuracionResenas.findFirst({
      where: (t, { eq: e }) => e(t.restauranteId, tenantId),
    });

    const resenasActivas = configRow?.resenasActivas ?? true;
    if (!resenasActivas) {
      return { success: false, message: 'Reseñas desactivadas temporalmente', derivadaAGoogle: false };
    }

    const minEstrellas = configRow?.minEstrellasGoogle ?? 4;
    const derivable = esDerivableAGoogle(estrellas, minEstrellas);
    const googleReviewUrl = configRow?.googleReviewUrl?.trim() || null;

    const aspectosLimpios = Array.isArray(input.aspectos)
      ? input.aspectos.map((a) => String(a).slice(0, 50))
      : [];

    const comentario = input.comentario ? String(input.comentario).trim().slice(0, 500) : null;
    const contactoNombre = input.contactoNombre ? String(input.contactoNombre).trim().slice(0, 80) : null;
    const contactoTelefono = input.contactoTelefono ? String(input.contactoTelefono).trim().slice(0, 40) : null;

    // 2. Guardar en base de datos
    await db.insert(resenasClientes).values({
      restauranteId: tenantId,
      origen: input.origen ?? 'mesa',
      mesaId: input.mesaId ?? null,
      pedidoId: input.pedidoId ?? null,
      identificadorMesa: input.identificadorMesa ?? null,
      estrellas,
      aspectos: aspectosLimpios,
      comentario,
      contactoNombre,
      contactoTelefono,
      derivadaAGoogle: derivable && !!googleReviewUrl,
      estado: 'nuevo',
    });

    // 3. Si es feedback privado (1, 2 o 3 estrellas), disparar alerta inmediata al staff
    if (!derivable && (configRow?.recibirAlertaNegativa ?? true)) {
      const mesaTxt = input.identificadorMesa ? ` en ${input.identificadorMesa}` : '';
      const aspectosTxt = aspectosLimpios.length > 0 ? ` (${aspectosLimpios.join(', ')})` : '';
      const comentarioTxt = comentario ? `: "${comentario}"` : '';

      await crearStaffAlert({
        restauranteId: tenantId,
        tipo: 'feedback_negativo',
        titulo: `⚠️ Opinión recibida${mesaTxt}: ${estrellas} ★`,
        cuerpo: `Calificación baja${aspectosTxt}${comentarioTxt}`,
        href: '/admin/resenas',
        metadata: {
          estrellas,
          aspectos: aspectosLimpios,
          mesa: input.identificadorMesa ?? null,
          contactoTelefono,
        },
      });
    }

    return {
      success: true,
      derivadaAGoogle: derivable && !!googleReviewUrl,
      googleReviewUrl: derivable ? googleReviewUrl : null,
    };
  } catch (error) {
    console.error('[enviarFeedbackAction]', error);
    return {
      success: false,
      message: 'No se pudo guardar tu opinión. Probá de nuevo.',
      derivadaAGoogle: false,
    };
  }
}

/**
 * Consulta pública de la configuración de reseñas para el widget del comensal.
 */
export async function getConfigResenasPublicAction(slug: string): Promise<{
  activas: boolean;
  googleReviewUrl: string | null;
  minEstrellasGoogle: number;
} | null> {
  const tenantId = await getTenantBySlug(slug);
  if (!tenantId) return null;

  const configRow = await db.query.configuracionResenas.findFirst({
    where: (t, { eq: e }) => e(t.restauranteId, tenantId),
  });

  return {
    activas: configRow?.resenasActivas ?? true,
    googleReviewUrl: configRow?.googleReviewUrl ?? null,
    minEstrellasGoogle: configRow?.minEstrellasGoogle ?? 4,
  };
}

/**
 * Obtener listado de reseñas y métricas para el panel del admin.
 */
export async function getResenasAdminAction(): Promise<{
  resenas: ResenaClienteDto[];
  config: ConfiguracionResenasDto;
  metricas: ResenasMetricsDto;
} | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const tenantId = session.restauranteId;

  try {
    const [rows, configRow] = await Promise.all([
      db
        .select()
        .from(resenasClientes)
        .where(eq(resenasClientes.restauranteId, tenantId))
        .orderBy(desc(resenasClientes.createdAt))
        .limit(200),
      db.query.configuracionResenas.findFirst({
        where: (t, { eq: e }) => e(t.restauranteId, tenantId),
      }),
    ]);

    const resenas: ResenaClienteDto[] = rows.map((r) => ({
      id: r.id,
      origen: r.origen as ResenaClienteDto['origen'],
      mesaId: r.mesaId,
      pedidoId: r.pedidoId,
      identificadorMesa: r.identificadorMesa,
      estrellas: r.estrellas,
      aspectos: Array.isArray(r.aspectos) ? (r.aspectos as string[]) : [],
      comentario: r.comentario,
      contactoNombre: r.contactoNombre,
      contactoTelefono: r.contactoTelefono,
      derivadaAGoogle: r.derivadaAGoogle,
      estado: r.estado as EstadoResena,
      createdAt: r.createdAt,
    }));

    const config: ConfiguracionResenasDto = {
      googleReviewUrl: configRow?.googleReviewUrl ?? '',
      resenasActivas: configRow?.resenasActivas ?? true,
      minEstrellasGoogle: configRow?.minEstrellasGoogle ?? 4,
      recibirAlertaNegativa: configRow?.recibirAlertaNegativa ?? true,
    };

    const metricas = calcularMetricasResenas(resenas);

    return { resenas, config, metricas };
  } catch (error) {
    console.error('[getResenasAdminAction]', error);
    return null;
  }
}

/**
 * Actualizar configuración de reseñas (URL de Google Maps, toggle, etc.).
 */
export async function actualizarConfigResenasAction(input: {
  googleReviewUrl?: string;
  resenasActivas?: boolean;
  minEstrellasGoogle?: number;
  recibirAlertaNegativa?: boolean;
}): Promise<{ success: boolean; message?: string }> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageSettings')) {
    return { success: false, message: 'No tenés permiso' };
  }

  const tenantId = session.restauranteId;
  const googleReviewUrl = (input.googleReviewUrl ?? '').trim();
  const resenasActivas = input.resenasActivas ?? true;
  const minEstrellasGoogle = Math.min(5, Math.max(1, Number(input.minEstrellasGoogle) || 4));
  const recibirAlertaNegativa = input.recibirAlertaNegativa ?? true;

  try {
    const existing = await db.query.configuracionResenas.findFirst({
      where: (t, { eq: e }) => e(t.restauranteId, tenantId),
    });

    if (existing) {
      await db
        .update(configuracionResenas)
        .set({
          googleReviewUrl,
          resenasActivas,
          minEstrellasGoogle,
          recibirAlertaNegativa,
          updatedAt: new Date(),
        })
        .where(eq(configuracionResenas.id, existing.id));
    } else {
      await db.insert(configuracionResenas).values({
        restauranteId: tenantId,
        googleReviewUrl,
        resenasActivas,
        minEstrellasGoogle,
        recibirAlertaNegativa,
      });
    }

    revalidatePath('/admin/resenas');
    return { success: true };
  } catch (error) {
    console.error('[actualizarConfigResenasAction]', error);
    return { success: false, message: 'Error al guardar la configuración' };
  }
}

/**
 * Cambiar el estado de una reseña interna (nuevo -> leido -> contactado -> resuelto).
 */
export async function cambiarEstadoResenaAction(input: {
  resenaId: string;
  estado: EstadoResena;
}): Promise<{ success: boolean; message?: string }> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageSettings')) {
    return { success: false, message: 'No tenés permiso' };
  }

  try {
    await db
      .update(resenasClientes)
      .set({ estado: input.estado })
      .where(
        and(
          eq(resenasClientes.id, input.resenaId),
          eq(resenasClientes.restauranteId, session.restauranteId),
        ),
      );

    revalidatePath('/admin/resenas');
    return { success: true };
  } catch (error) {
    console.error('[cambiarEstadoResenaAction]', error);
    return { success: false, message: 'Error al actualizar estado' };
  }
}
