import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

  // getUser() refresca el token si es necesario y verifica la sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- 2. Protección de rutas autenticadas ---
  // Rutas que requieren autenticación
  const protectedPaths = ['/admin'];
  const isProtectedRoute = protectedPaths.some((p) => path.startsWith(p));

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // --- 3. Redirigir usuarios autenticados lejos del login ---
  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // --- 4. Lógica de subdominios (tenants) ---
  const mainDomain =
    process.env.NODE_ENV === 'production'
      ? 'acomer.com.ar' // (Reemplazar por tu dominio final)
      : 'localhost:3000';

  // Excluir el dominio principal y el panel de administración genérico
  if (hostname === mainDomain || hostname === `app.${mainDomain}`) {
    return response;
  }

  // Si llegamos acá, es un subdominio de un restaurante.
  // Extraemos el slug (ej: "pizzeria" de "pizzeria.acomer.com.ar")
  const tenantSlug = hostname.replace(`.${mainDomain}`, '');

  // Validar que el slug es válido (alphanumeric, no vacío)
  if (!tenantSlug || !/^[a-z0-9-]+$/.test(tenantSlug)) {
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  // Reescribimos internamente la ruta.
  // La URL original de la barra del navegador NO cambia para el usuario.
  // Internamente, Next.js buscará en la carpeta: app/[tenant]/...
  return NextResponse.rewrite(
    new URL(`/${tenantSlug}${url.pathname}${url.search}`, req.url)
  );
}