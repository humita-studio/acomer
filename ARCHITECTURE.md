# Arquitectura

Este documento describe cómo está organizado el código de **acomer**, las convenciones que seguimos y cómo extenderlo. Es la referencia para sumarse al proyecto; para correrlo, ver el [README](./README.md).

---

## 1. Visión general

acomer es un SaaS **multi-tenant**: un mismo deploy atiende a muchos restaurantes, cada uno resuelto por su **subdominio**. El middleware `proxy.ts` (rename de `middleware` en Next 16) toma el host, deriva el _slug_ del local y reescribe la request al segmento `[tenant]`. Además refresca la sesión de Supabase en cada request (cookies) y protege `/admin` (redirige a `/login` si no hay sesión).

Hay tres superficies de usuario, que se corresponden con carpetas de `app/`:

| Superficie | Ruta | Quién la usa |
| --- | --- | --- |
| Landing | `app/(landing)` | público / marketing |
| Cliente del local | `app/[tenant]` | comensal (escanea el QR, pide, reserva, paga) |
| Panel de gestión | `app/admin` | dueño / encargado / mozo |

La autenticación de empleados es por Supabase Auth; el comensal opera **sin login** (se identifica por el QR de la mesa o por el flujo de checkout).

---

## 2. Screaming architecture

La estructura "grita" el dominio, no el framework. Tres capas:

```text
app/        Shells de ruta. Sólo hacen: auth/guard, fetch inicial y componer un <XManager> de la feature.
features/   Cada dominio, self-contained. Acá vive la lógica de negocio.
shared/     Código genérico que no pertenece a ningún dominio (db, ui, helpers).
```

**Por qué.** Antes la lógica de servidor ya estaba en `features/`, pero la UI de cada dominio vivía atrapada en `app/admin/**`. Mover la UI a su feature deja las páginas como shells delgados, hace cada dominio comprensible de un vistazo y evita que `app/` se vuelva un cajón de sastre.

**Regla de oro:** una feature **nunca** importa de otra feature. Si dos dominios necesitan lo mismo, sube a `shared/`. Las únicas dependencias entre features son las "de cimiento" explícitas (ver [§6](#6-mapa-de-features)).

---

## 3. Convenciones de naming

**Archivos en camelCase**, con dos excepciones:

1. Componentes `.tsx` → **PascalCase** (`PromocionesManager.tsx`).
2. Carpetas de ruta en `app/` → **kebab-case** (son URLs: `app/admin/venta-mostrador`).

### Anatomía de una feature

```text
features/<dominio>/
├── components/          UI del dominio (PascalCase). El de entrada suele ser <Dominio>Manager.tsx
├── hooks/               Hooks de cliente (useX.ts), partidos por agregado — no un hook gigante
├── <dominio>Actions.ts  Server Actions ('use server'), partidas por caso de uso
├── <dominio>Core.ts     Lógica pura reutilizable (sin 'use server') — opcional, ver §5
└── types.ts             Modelo de dominio y tipos compartidos
```

- Los archivos planos (`xActions.ts`, `xCore.ts`, `types.ts`) se promueven a carpeta sólo si superan ~3 archivos. **No** un único `feature.action.ts` que recree el god-file: split por caso de uso.
- Los hooks gritan el dominio (`useProductos.ts`, `useCategorias.ts`), no nombres genéricos tipo `useCreate`.

> La convención es la **meta**. Quedan algunos archivos en kebab-case (p. ej. en `mesas/` y `comanda/`) que se migran cuando se tocan.

---

## 4. Servidor vs. cliente

### Lecturas → Server Components

Las páginas (`app/**/page.tsx`) son Server Components `async`: hacen el guard de auth, leen de la DB (Drizzle) o llaman a una action de lectura, y pasan los datos como `initialData` al componente cliente. Para datos independientes, paralelizar con `Promise.all` (evitar waterfalls).

### Mutaciones → Server Actions (con auth)

Toda mutación es una Server Action (`'use server'`). **Toda action que toca datos de un local valida sesión + permiso y scopea por tenant:**

```ts
const session = await getCurrentSession();
if (!session || !hasPermission(session.role, 'canX')) {
  return { success: false, message: 'Sin permiso' };
}
// ...usar SIEMPRE session.restauranteId para scopear
```

Las actions públicas (cliente sin login: pedido online, mesa por QR) validan el **tenant** (`getTenantBySlug`) y la config del local en lugar de sesión, y **snapshotean precios desde la DB** (nunca confían en el precio que manda el cliente).

### APIs externas → Route Handlers

Los Route Handlers (`app/api`) se reservan para **callers externos**: los webhooks de Mercado Pago (`api/webhooks/pagos/[provider]`, `api/webhooks/pagos/mp-oauth`) y el logout. La comunicación interna no los usa (van Server Components para leer y Server Actions para mutar).

### Estado en el cliente

- **TanStack Query** para estado de servidor (cache, refetch, realtime). El `initialData` viene del Server Component.
- **Zustand** para estado de UI que cambia por interacción (carrito, editor de plano de mesas).

### Performance

- `React.cache()` envuelve lecturas que se repiten dentro de un mismo request (`getCurrentSession`, `getTenantBySlug`) → 1 query por request en vez de 2-3.
- `next/dynamic` para librerías pesadas y client-only (p. ej. **recharts** en `dashboard` y `reportes`), para mantenerlas fuera del bundle inicial.

---

## 5. Patrón `-core`

La reutilización real vive en funciones puras, no en componentes. Un `<dominio>Core.ts` contiene lógica sin `'use server'` y las Server Actions son wrappers finos que la envuelven (auth + revalidate).

Ejemplo: `crearPedidoCore` (en `features/pedidos`) crea un pedido con items y lo reusan 4 actions distintas (mesa, online, mostrador, staff). Cada superficie aporta su contexto; el cómo se arma el pedido es uno solo.

---

## 6. Mapa de features

Son 17 dominios. Los **cimientos** son consumidos por otros (única dirección permitida, sin ciclos):

| Feature | Rol | Capa |
| --- | --- | --- |
| `auth` | Sesión/login, perfil de empleado (`getCurrentSession`) | cimiento |
| `authorization` | Roles y permisos (`hasPermission`, `canAccessSection`) | cimiento |
| `tenant` | Resolución del local por slug (`getTenantBySlug`) | cimiento |
| `carta` | Carta + carrito (kernel de UI: `MenuView`, `cart.ts`, `useLocalCart`) | cimiento |
| `pedidos` | Kernel de creación de pedidos (`crearPedidoCore`) + lecturas de ticket | cimiento |
| `comanda` | Servicio en mesa: sesión, borrador compartido, ticket, carga del mozo, realtime | operación |
| `mesas` | Plano/ambientes/mesas (editor canvas), sesiones, QR, dividir/unir | operación |
| `venta-mostrador` | Venta rápida sin mesa (mostrador): armar → cobrar | operación |
| `pedidos-online` | Takeaway/delivery web: menú externo, checkout, seguimiento, config | operación |
| `reservas` | Reservas online + agenda del admin + configuración | operación |
| `pagos` | Mercado Pago (providers, webhooks, OAuth), pago presencial, ticket | plata |
| `cobros` | Gestión de cobros desde el panel | plata |
| `caja` | Apertura/cierre y arqueo de caja | plata |
| `promociones` | Descuentos y combos (cálculo + admin) | plata |
| `menu` | Gestión de la carta (productos, categorías, modificadores, precios) | panel |
| `dashboard` | Métricas del panel (ventas, ocupación, pedidos recientes) | panel |
| `reportes` | Reportes con gráficos (ventas, métodos, top productos, ocupación) | panel |

**Dominio de pedidos (capas):** `carta` (carta+carrito) y `pedidos` (kernel) son los cimientos; sobre ellos se apoyan `comanda`, `pedidos-online` y `venta-mostrador`. Una sola dirección, sin ciclos.

---

## 7. `shared/`

Código genérico, transversal a todos los dominios:

| Carpeta | Contenido |
| --- | --- |
| `shared/db` | Instancia Drizzle, `schema.ts`, wrapper seguro |
| `shared/ui` | Componentes base (shadcn/ui) |
| `shared/query` | Claves de TanStack Query (`queryKeys`) |
| `shared/supabase` | Clientes Supabase (`browser` / `server`) |
| `shared/lib`, `shared/utils` | Helpers, formateadores (`formatPeso`, `cn`, …) |

---

## 8. Reglas de reuso

- **Rule of three:** no abstraigas a "reutilizable" hasta el tercer uso.
- **Nunca feature → feature.** Si dos features necesitan lo mismo, sube a `shared/` (o, si es un cimiento del dominio, expónelo explícitamente como en §6).
- Preferí reusar **lógica pura** (`-core`) antes que componentes.

---

## 9. How-to: agregar una feature nueva

1. Creá `features/<dominio>/` con `types.ts` (modelo) y `<dominio>Actions.ts` (`'use server'`).
2. Poné la UI en `components/<Dominio>Manager.tsx` (PascalCase). Si hay estado de servidor en el cliente, agregá `hooks/use<X>.ts`.
3. La página en `app/.../page.tsx` queda como **shell**: Server Component que hace el guard de auth, fetchea los datos iniciales y renderiza `<DominioManager initial... />`.
4. Si necesitás algo de otra feature, no la importes: subí lo compartido a `shared/`.

## 10. How-to: crear una server action segura

```ts
'use server';

import { db } from '@/shared/db';
import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';

export async function actualizarXAction(input: XInput) {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageX')) {
    return { success: false, message: 'No tenés permiso' };
  }

  try {
    await db
      .insert(tablaX)
      .values({ ...input, restauranteId: session.restauranteId }); // scope por tenant SIEMPRE

    revalidatePath('/admin/x');
    return { success: true };
  } catch (error) {
    console.error('[actualizarXAction]', error);
    return { success: false, message: 'Error al guardar' };
  }
}
```

Puntos clave: `'use server'`, validar sesión + permiso, **scopear por `restauranteId`**, `revalidatePath` tras la mutación, y devolver un resultado serializable `{ success, message? }` (nunca lanzar datos no serializables al cliente).
