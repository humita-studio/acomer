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
  const accessToken = formData.get('accessToken') as string;

  if (!proveedor) {
    throw new Error('Falta el proveedor');
  }

  let credenciales = {};
  if (proveedor === 'mercado_pago') {
    if (!accessToken) {
      throw new Error('Access Token es requerido para Mercado Pago');
    }
    credenciales = { access_token: accessToken };
  }

  await withTenant(claimsFromSession(session), async (db) => {
    // Check if configuration already exists for this tenant
    const existingConfig = await db.query.configuracionPagos.findFirst({
      where: (t, { eq }) => eq(t.restauranteId, session.restauranteId)
    });

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
      await db.insert(configuracionPagos).values({
        restauranteId: session.restauranteId,
        proveedor,
        credenciales,
        activo: true,
      });
    }
  });

  revalidatePath('/admin/configuracion');
}

