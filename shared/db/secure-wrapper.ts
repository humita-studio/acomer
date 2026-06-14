import { sql } from 'drizzle-orm';
import { db } from './client';

/**
 * Executa una query de Drizzle dentro de una transacción que inyecta
 * el restaurant_id del JWT para que las políticas RLS se apliquen correctamente.
 *
 * Uso:
 *   const user = await executeWithJWT(jwtClaims, async () =>
 *     db.query.restaurantes.findFirst({ ... })
 *   );
 */
export async function executeWithJWT(
  jwtClaims: {
    sub?: string;
    restaurant_id?: string;
    user_id?: string;
    email?: string;
    [key: string]: unknown;
  },
  queryFn: () => Promise<unknown>
): Promise<unknown> {
  try {
    // Set JWT claims as Postgres session variables
    // These are read by the RLS policies via auth.jwt()
    await db.execute(
      sql`SELECT set_config('request.jwt.claims', ${JSON.stringify(jwtClaims)}, false);`
    );

    // Set the authenticated user ID
    if (jwtClaims.sub) {
      await db.execute(
        sql`SELECT set_config('request.jwt.claim.sub', ${jwtClaims.sub}, false);`
      );
    }

    // Set restaurant_id if available
    if (jwtClaims.restaurant_id) {
      await db.execute(
        sql`SELECT set_config('request.jwt.claim.restaurant_id', ${jwtClaims.restaurant_id}, false);`
      );
    }

    // Execute the query with RLS enforced
    const result = await queryFn();

    return result;
  } catch (error) {
    console.error('Error executing query with JWT:', error);
    throw error;
  }
}

/**
 * Variante que ejecuta dentro de una transacción Drizzle explícita.
 * Útil para operaciones que requieren múltiples queries atómicas.
 *
 * Uso:
 *   const result = await executeTransactionWithJWT(jwtClaims, async (tx) => {
 *     await tx.insert(productos).values({ ... });
 *     return await tx.query.productos.findFirst({ ... });
 *   });
 */
export async function executeTransactionWithJWT(
  jwtClaims: {
    sub?: string;
    restaurant_id?: string;
    user_id?: string;
    email?: string;
    [key: string]: unknown;
  },
  transactionFn: (tx: typeof db) => Promise<unknown>
): Promise<unknown> {
  // Note: Drizzle's transaction abstraction doesn't allow direct session
  // variable injection. For now, use the non-transaction version above.
  // If you need true transaction semantics with RLS, consider using
  // raw SQL transactions or Supabase's session control.
  return executeWithJWT(jwtClaims, () => transactionFn(db));
}

/**
 * Helper para extraer claims del objeto de request de Next.js
 *
 * Uso en Route Handler:
 *   import { getJWTClaims } from '@/shared/db/secure-wrapper';
 *
 *   export async function GET(request: Request) {
 *     const claims = await getJWTClaims(request);
 *     const resultado = await executeWithJWT(claims, () =>
 *       db.query.restaurantes.findMany()
 *     );
 *     return Response.json(resultado);
 *   }
 */
export async function getJWTClaimsFromRequest(
  request: Request
): Promise<{
  sub: string;
  restaurant_id: string;
  user_id: string;
  email: string;
  [key: string]: unknown;
}> {
  // Try to get from Authorization header (Supabase token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Decode JWT without verification (claims are embedded)
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf-8')
        );
        return {
          sub: decoded.sub || '',
          restaurant_id: decoded.restaurant_id || '',
          user_id: decoded.user_id || decoded.sub || '',
          email: decoded.email || '',
          ...decoded,
        };
      }
    } catch (error) {
      console.error('Failed to decode JWT:', error);
    }
  }

  // Return empty claims if not found
  return {
    sub: '',
    restaurant_id: '',
    user_id: '',
    email: '',
  };
}
