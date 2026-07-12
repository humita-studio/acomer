import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { extractTenantSlug } from '@/shared/lib/tenant-host';

export const config = {
  matcher: [
    // Se ejecuta en todas las rutas excepto en estáticos, imágenes, favicon y la carpeta de la API.
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const path = url.pathname;

  // --- 1. Refresh de sesión Supabase (necesario para mantener cookies actualizadas) ---
  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Setear cookies en el request (para que downstream las lea)
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          // Re-crear response con headers actualizados
          response = NextResponse.next({
            request: { headers: req.headers },
          });
          // Setear cookies en el response (para que el browser las reciba)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // --- 2. Protección de rutas autenticadas ---
  const protectedPaths = ['/admin'];
  const isProtectedRoute = protectedPaths.some((p) => path.startsWith(p));
  const isAuthRoute = path === '/login' || path === '/register';

  // Optimización: Solo hacemos getUser() (que requiere request a BD) en rutas que lo necesitan
  let user = null;
  if (isProtectedRoute || isAuthRoute) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // --- 3. Redirigir usuarios autenticados lejos del login ---
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // --- 4. Lógica de subdominios (tenants) ---
  // Configurable por env var; cae al dominio final en prod y a localhost en dev.
  const mainDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    (process.env.NODE_ENV === 'production'
      ? 'acomer.com.ar' // Dominio principal en producción
      : 'localhost:3000');

  // Apex / www / app / vercel → sin tenant. Subdominio válido → rewrite a /[slug]/...
  const tenantSlug = extractTenantSlug(hostname, mainDomain);
  if (!tenantSlug) {
    return response;
  }

  // Reescribimos internamente la ruta.
  // La URL original de la barra del navegador NO cambia para el usuario.
  // Internamente, Next.js buscará en la carpeta: app/[tenant]/...
  return NextResponse.rewrite(
    new URL(`/${tenantSlug}${url.pathname}${url.search}`, req.url)
  );
}