import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/db';
import { configuracionPagos } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const tenantId = url.searchParams.get('state'); // We passed tenantId in state

    if (!code || !tenantId) {
      return NextResponse.redirect(new URL('/admin/configuracion?error=missing_params', req.url));
    }

    const clientId = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/pagos/mp-oauth`;

    if (!clientId || !clientSecret) {
      console.error('Missing MP OAuth credentials in environment');
      return NextResponse.redirect(new URL('/admin/configuracion?error=server_error', req.url));
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error exchanging MP code for token:', errorData);
      return NextResponse.redirect(new URL('/admin/configuracion?error=oauth_failed', req.url));
    }

    const data = await tokenResponse.json();
    /*
      Expected data structure:
      {
        "access_token": "...",
        "token_type": "bearer",
        "expires_in": 15552000,
        "scope": "offline_access read write",
        "user_id": 123456,
        "refresh_token": "...",
        "public_key": "..."
      }
    */

    const credenciales = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      public_key: data.public_key,
      user_id: data.user_id,
      expires_in: data.expires_in,
      obtained_at: new Date().toISOString(),
    };

    // Save or update in DB
    const existingConfig = await db.query.configuracionPagos.findFirst({
      where: (t, { eq }) => eq(t.restauranteId, tenantId)
    });

    if (existingConfig) {
      await db.update(configuracionPagos)
        .set({
          proveedor: 'mercado_pago_oauth',
          credenciales,
          activo: true,
          updatedAt: new Date()
        })
        .where(eq(configuracionPagos.id, existingConfig.id));
    } else {
      await db.insert(configuracionPagos).values({
        restauranteId: tenantId,
        proveedor: 'mercado_pago_oauth',
        credenciales,
        activo: true,
      });
    }

    // Redirect back to config page with success message
    return NextResponse.redirect(new URL('/admin/configuracion?success=mp_connected', req.url));

  } catch (error) {
    console.error('MP OAuth error:', error);
    return NextResponse.redirect(new URL('/admin/configuracion?error=internal_error', req.url));
  }
}
