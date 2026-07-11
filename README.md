# acomer

SaaS multi-tenant para restaurantes: **carta digital por QR**, **comandas compartidas en tiempo real**, **reservas**, **pedidos online** (takeaway/delivery) y **cobros con Mercado Pago**. Cada local vive en su propio subdominio (p. ej. `pizzeria.acomer...`).

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui + lucide-react; dark mode con `next-themes`
- **Estado:** Zustand (UI) + TanStack Query / Server Actions (servidor)
- **Datos & Auth:** Supabase (PostgreSQL, Auth, Realtime) + Drizzle ORM
- **Pagos:** Mercado Pago (Checkout Pro + OAuth por local)
- **Infra:** Vercel; multi-tenant por subdominio vía `proxy.ts` (middleware de Next)
- **Tooling:** Bun

## Cómo correr

```bash
bun install
# Completá las variables en .env (ver abajo)
bun run dev        # http://localhost:3000
```

Otros scripts:

```bash
bun run build      # build de producción
bun run start      # sirve el build
bun run lint       # eslint
```

### Variables de entorno (`.env`)

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Conexión Postgres (Supabase) para Drizzle |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase (cliente) |
| `SUPABASE_SECRET_KEY` | Clave de servicio de Supabase (servidor) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (links y webhooks) |
| `NEXT_PUBLIC_MP_CLIENT_ID` | Client ID de Mercado Pago (OAuth) |
| `MP_CLIENT_SECRET` | Client secret de Mercado Pago (OAuth) |
| `MP_WEBHOOK_SECRET` | (Opcional en local) Secret de firma de webhooks MP (`x-signature`) |

```bash
bun run test       # unit tests (vitest)
bun run typecheck  # tsc --noEmit
```

## Estructura

```text
app/        Shells de ruta (App Router): sólo enrutado y composición
features/   Lógica de negocio aislada por dominio (17 features)
shared/     Código genérico transversal (db, ui, query, supabase, lib)
proxy.ts    Middleware de Next: resuelve el subdominio → tenant
```

La organización sigue **screaming architecture**: cada dominio es self-contained en `features/` y las páginas de `app/` son shells delgados que sólo componen.

👉 Para convenciones, mapa de features y cómo agregar código, ver **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

> Nota: este proyecto corre una versión de Next.js con cambios respecto a lo habitual. Antes de escribir código, leé la guía correspondiente en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
