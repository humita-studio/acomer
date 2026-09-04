import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { configuracionPagos } from '@/shared/db/schema';
import { withTenant } from '@/shared/db/secure-wrapper';
import { getCurrentSession, claimsFromSession } from '@/features/auth/session';

/**
 * Callback OAuth de Mercado Pago (vinculación de la cuenta MP del local).
 *
 * Seguridad: el `state` trae el id del restaurante que inició la vinculación,
 * pero NO se confía en él. La cuenta MP se guarda sólo sobre el restaurante de
 * la sesión del dueño/admin logueado, y se exige que coincida con `state`.
 * Sin este chequeo cualquiera podía redirigir el flujo con el `state` de otro
 * local y quedarse con los cobros de ese restaurante.
 */
export async function GET(req: NextRequest) {
  const backTo = (query: string) =>
    NextResponse.redirect(new URL(`/admin/configuracion?${query}`, req.url));

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return backTo('error=missing_params');
    }

    const session = await getCurrentSession();
    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
      // Sin sesión de dueño/admin en este navegador: volver a entrar y reintentar.
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (state !== session.restauranteId) {
      console.warn('[mp-oauth] state no coincide con la sesión', {
        state,
        restauranteId: session.restauranteId,
        actor: session.user.email,
      });
      return backTo('error=state_mismatch');
    }

    const clientId = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/pagos/mp-oauth`;

    if (!clientId || !clientSecret) {
      console.error('[mp-oauth] faltan NEXT_PUBLIC_MP_CLIENT_ID / MP_CLIENT_SECRET');
      return backTo('error=server_error');
    }

    // Intercambio code → token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[mp-oauth] intercambio de code falló:', errorData);
      return backTo('error=oauth_failed');
    }

    const data = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      public_key?: string;
      user_id?: number;
      expires_in?: number;
    };

    if (!data.access_token) {
      console.error('[mp-oauth] respuesta sin access_token');
      return backTo('error=oauth_failed');
    }

    const credenciales = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      public_key: data.public_key,
      user_id: data.user_id,
      expires_in: data.expires_in,
      obtained_at: new Date().toISOString(),
    };

    const restauranteId = session.restauranteId;
    await withTenant(claimsFromSession(session), async (db) => {
      const existingConfig = await db.query.configuracionPagos.findFirst({
        where: (t, { eq }) => eq(t.restauranteId, restauranteId),
      });

      if (existingConfig) {
        await db
          .update(configuracionPagos)
          .set({
            proveedor: 'mercado_pago_oauth',
            credenciales,
            activo: true,
            updatedAt: new Date(),
          })
          .where(eq(configuracionPagos.id, existingConfig.id));
      } else {
        await db.insert(configuracionPagos).values({
          restauranteId,
          proveedor: 'mercado_pago_oauth',
          credenciales,
          activo: true,
        });
      }
    });

    return backTo('success=mp_connected');
  } catch (error) {
    console.error('[mp-oauth]', error);
    return backTo('error=internal_error');
  }
}
