'use server';

import { configuracionPagos } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';
import { withTenant } from '@/shared/db/secure-wrapper';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function guardarConfiguracionPagosAction(formData: FormData) {
  const session = await getCurrentSession();
  
  // Only owners or admins can configure payments
  if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
    redirect('/unauthorized');
  }

  const proveedor = formData.get('proveedor') as string;
  const accessToken = (formData.get('accessToken') as string | null)?.trim() || '';

  if (!proveedor) {
    throw new Error('Falta el proveedor');
  }

  await withTenant(claimsFromSession(session), async (db) => {
    // Check if configuration already exists for this tenant
    const existingConfig = await db.query.configuracionPagos.findFirst({
      where: (t, { eq }) => eq(t.restauranteId, session.restauranteId)
    });

    // No pisar las credenciales OAuth al solo cambiar de proveedor o "Guardar".
    // Antes se mandaba `credenciales: {}` y se borraba el access_token vinculado.
    const prevCreds =
      (existingConfig?.credenciales as Record<string, unknown> | null) ?? {};

    let credenciales: Record<string, unknown> = prevCreds;
    if (proveedor === 'mercado_pago') {
      if (accessToken) {
        credenciales = { ...prevCreds, access_token: accessToken };
      } else if (!prevCreds.access_token) {
        throw new Error('Access Token es requerido para Mercado Pago');
      }
    }
    // mercado_pago_oauth y mock: conservar token por si vuelven a MP sin re-vincular.

    if (existingConfig) {
      await db.update(configuracionPagos)
        .set({
          proveedor,
          credenciales,
          activo: true,
          updatedAt: new Date()
        })
        .where(eq(configuracionPagos.id, existingConfig.id));
    } else {
      if (proveedor === 'mercado_pago' && !accessToken) {
        throw new Error('Access Token es requerido para Mercado Pago');
      }
      await db.insert(configuracionPagos).values({
        restauranteId: session.restauranteId,
        proveedor,
        credenciales: proveedor === 'mercado_pago' ? { access_token: accessToken } : {},
        activo: true,
      });
    }
  });

  revalidatePath('/admin/configuracion');
}

