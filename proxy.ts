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
  // Clonar headers para poder inyectar pathname (gate de billing en layout admin).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', path);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
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
          // Re-crear response con headers actualizados (mantener x-pathname)
          const nextHeaders = new Headers(req.headers);
          nextHeaders.set('x-pathname', path);
          response = NextResponse.next({
            request: { headers: nextHeaders },
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
  // /auth/* es el callback de Supabase (code exchange); no redirigir.
  if (path.startsWith('/auth/')) {
    return response;
  }

  const protectedPaths = ['/admin', '/platform'];
  const isProtectedRoute = protectedPaths.some((p) => path.startsWith(p));
  const isPlatformRoute = path.startsWith('/platform');
  const isAuthRoute =
    path === '/login' || path === '/register' || path === '/forgot-password';
  const isChangePasswordRoute = path === '/cambiar-password';

  // Optimización: Solo hacemos getUser() (que requiere request a BD) en rutas que lo necesitan
  let user = null;
  if (isProtectedRoute || isAuthRoute || isChangePasswordRoute) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const mustChangePassword =
    user?.user_metadata?.must_change_password === true;

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Staff con contraseña temporal: no entra al panel del local hasta cambiarla.
  // /platform no exige cambio (operadores de acomer no usan temp password de staff).
  if (isProtectedRoute && user && mustChangePassword && !isPlatformRoute) {
    return NextResponse.redirect(new URL('/cambiar-password', req.url));
  }

  if (isChangePasswordRoute && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // --- 3. Redirigir usuarios autenticados lejos del login/registro ---
  // Destino fino (admin vs platform) lo resuelve LoginForm / layout admin.
  if (isAuthRoute && user) {
    const dest = mustChangePassword ? '/cambiar-password' : '/admin';
    return NextResponse.redirect(new URL(dest, req.url));
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