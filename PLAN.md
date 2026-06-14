```
# 🚀 Master Plan: SaaS Multi-Tenant para Restaurantes

## 🎯 Contexto del Proyecto
Desarrollo de un sistema SaaS multi-tenant para locales gastronómicos. El core del sistema es una **carta digital interactiva con sistema de comandas compartidas en tiempo real** (múltiples comensales en una misma mesa escaneando un QR) y gestión de pagos integrada (Mercado Pago). 

## 🛠️ Stack Tecnológico Definido
* **Framework:** Next.js (App Router) + TypeScript.
* **Estilos y UI:** Tailwind CSS + shadcn/ui.
* **Base de Datos & Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions).
* **ORM:** Drizzle ORM (Optimizado para Edge y consultas seguras con RLS).
* **Estado Global (Cliente):** Zustand.
* **Infraestructura:** Vercel (Edge Middleware para subdominios `*.tuapp.com`).
* **Pagos:** Mercado Pago (Checkout Pro B2C y Suscripciones B2B).

---

## 📂 1. Arquitectura de Carpetas (Feature-Sliced Design)

El proyecto utiliza una arquitectura modular para separar el enrutamiento de la lógica de negocio. **Regla estricta:** La lógica de negocio NO debe vivir en la carpeta `app/`.

```text
📦 raiz-del-proyecto
├── 📄 middleware.ts                  # Captura *.tuapp.com y reescribe a /[tenant]
└── 📂 src
    ├── 📂 app                        # 🔴 SOLO RUTAS
    │   ├── 📂 (landing)              # Landing page comercial
    │   ├── 📂 admin                  # Panel de dueños (app.tuapp.com)
    │   └── 📂 [tenant]               # Frontend del comensal (ej. pizzeria.tuapp.com)
    │       └── 📂 mesa
    │           └── 📂 [mesaId]       # Comanda en tiempo real
    ├── 📂 features                   # 🔵 LÓGICA DE NEGOCIO (Aislada por dominio)
    │   ├── 📂 auth                   # Supabase Auth, sesión staff y permisos
    │   ├── 📂 tenant                 # Extracción de ID y RLS wrapper
    │   ├── 📂 menu                   # CRUD Platos, Server Actions, Zustand de Menú
    │   ├── 📂 comanda                # Zustand Store (Carrito), Sincronización Realtime
    │   └── 📂 pagos                  # SDK Mercado Pago y Webhooks
    └── 📂 shared                     # 🟢 CÓDIGO COMPARTIDO
        ├── 📂 db                     # Drizzle instance y schemas
        └── 📂 ui                     # shadcn/ui components
```

---

## 💾 2. Esquema de Base de Datos Completo (PostgreSQL / Drizzle)

Este esquema garantiza el aislamiento multi-tenant, la inmutabilidad contable y el manejo de comandas concurrentes.

### Core / Tenants

```sql
CREATE TABLE restaurantes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  slug       text NOT NULL UNIQUE, 
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz -- Soft delete
);
```

### Auth, Staff y Roles

```sql
CREATE TABLE perfiles_empleados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE, -- auth.users
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  rol           text NOT NULL CHECK (rol IN ('owner','admin','cajero','mozo','cocina')),
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Matriz de permisos por rol (documentada en el código y aplicada en RLS)
-- owner/admin: menú, precios, mesas, empleados, credenciales MP
-- cajero: cobrar, cerrar mesa, ver cuenta
-- mozo: ver pedidos, marcar entregado, llamadas de mesa
-- cocina: solo Kanban operativo y estados de preparación
```

### Catálogo y Precios (Ledger Append-Only)

```sql
CREATE TABLE categorias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  activo        boolean DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz 
);

-- Entidad "viva" (solo mutan textos, NUNCA el precio)
CREATE TABLE productos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  categoria_id         uuid NOT NULL REFERENCES categorias(id),
  nombre               text NOT NULL,
  descripcion          text,
  permite_adicionales  boolean NOT NULL DEFAULT false,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

-- Historial de precios (Append-only)
CREATE TABLE productos_precios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  producto_id   uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio        numeric(10,2) NOT NULL,
  vigente_desde timestamptz DEFAULT now(),
  vigente_hasta timestamptz, -- NULL = Es el precio actual
  creado_por    uuid
);
```

### Modificadores (Ingredientes Extras)

```sql
CREATE TABLE modificadores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  categoria     text,
  disponible    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE modificadores_precios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  modificador_id uuid NOT NULL REFERENCES modificadores(id) ON DELETE CASCADE,
  precio_extra   numeric(10,2) NOT NULL DEFAULT 0,
  vigente_desde  timestamptz DEFAULT now(),
  vigente_hasta  timestamptz
);

CREATE TABLE producto_modificadores_disponibles (
  producto_id    uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  modificador_id uuid NOT NULL REFERENCES modificadores(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, modificador_id)
);
```

### Salón y Sesiones (Lógica QR)

```sql
CREATE TABLE mesas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  identificador text NOT NULL, 
  qr_token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE sesiones_mesa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  mesa_id       uuid NOT NULL REFERENCES mesas(id),
  estado        text NOT NULL DEFAULT 'Activa', -- 'Activa' | 'Cerrada'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

### Comandas (Snapshots Inmutables)

```sql
CREATE TABLE pedidos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  sesion_mesa_id  uuid NOT NULL REFERENCES sesiones_mesa(id),
  estado          text NOT NULL DEFAULT 'Pendiente', 
  total           numeric(10,2) NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Snapshot de cómo era el producto al momento de pedir
CREATE TABLE comanda_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  pedido_id                uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id              uuid NOT NULL REFERENCES productos(id),
  cantidad                 int NOT NULL DEFAULT 1,
  nombre_producto_snapshot text NOT NULL,
  precio_unitario_snapshot numeric(10,2) NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Snapshot de los extras aplicados
CREATE TABLE comanda_item_modificadores (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id               uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  comanda_item_id             uuid NOT NULL REFERENCES comanda_items(id) ON DELETE CASCADE,
  modificador_id              uuid NOT NULL REFERENCES modificadores(id),
  nombre_modificador_snapshot text NOT NULL,
  precio_extra_snapshot       numeric(10,2) NOT NULL
);
```

### Auditoría y Logs

```sql
CREATE TABLE audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  tabla            text NOT NULL,
  registro_id      uuid NOT NULL,
  accion           text CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  realizado_por    uuid,
  realizado_at     timestamptz DEFAULT now()
);
```

---

## 🗺️ 3. Roadmap de Desarrollo (Épicas y Tareas)

### Épica 1: Cimientos de Datos y Seguridad (Drizzle + RLS)

- [x] Inicializar Next.js, instalar Supabase JS, Drizzle ORM y Postgres JS.
- [x] Traducir el esquema SQL documentado arriba a definiciones de `schema.ts` en Drizzle.
- [x] Generar migración SQL inicial con `drizzle-kit generate` (14 tablas, relaciones, constraints).
- [x] Aplicar migración en Supabase.
- [x] Crear triggers de auditoría en PostgreSQL para registrar INSERT/UPDATE/DELETE en `audit_log`.
- [x] Escribir políticas RLS en Supabase para aislar datos por `restaurant_id`.
- [x] Crear el "Wrapper Seguro" de Drizzle: Función que inyecta JWT claims en transacciones para respetar RLS.

### Épica 2: Enrutamiento Edge y Auth ✅

- [x] Configurar `proxy.ts` en Next.js 16 para interceptar subdominios comodín (`*.tuapp.com`) y reescribir a `/[tenant]`.
- [x] Crear utilidades de extracción (`features/tenant/get-tenant.ts`) para mapear el slug del subdominio a un `restaurant_id` válido.
- [x] Configurar Supabase Auth para registro e inicio de sesión de dueños de locales y empleados.
- [x] Crear tabla de relación `perfiles_empleados` para vincular el UID del usuario de Supabase Auth con su `restaurant_id`.
- [x] Definir y aplicar matriz de permisos por rol (`owner`, `admin`, `cajero`, `mozo`, `cocina`) sobre rutas, vistas y RLS (`features/authorization/roles.ts`).
- [x] Implementar invitación y alta de empleados por parte del dueño, con asignación de rol y estado `activo` (`features/auth/invite-employee.ts`).
- [x] Proteger `/admin` con sesión y renderizar navegación condicional según el rol del usuario autenticado (`app/admin/layout.tsx`).
- [x] Crear páginas de autenticación: `/login` y `/unauthorized`.

### Épica 3: Panel de Administración B2B (Dashboard)

- [x] Desarrollar Layout del panel de administración (Sidebar, Navbar) en la ruta `/admin`.
- [x] Crear CRUD de Categorías y Productos usando Server Actions y validación con Zod. Implementar *soft deletes* (`deleted_at`).
- [x] Desarrollar interfaz para modificar precios: la lógica debe insertar un nuevo registro en `productos_precios` y actualizar el `vigente_hasta` del anterior, nunca hacer un UPDATE directo del precio.
- [x] Interfaz de generador de Códigos QR por mesa vinculados al `qr_token`.
- [x] Crear monitor en tiempo real (Kanban) para la cocina/mozos usando Supabase Realtime.

### Épica 4: Comanda Compartida B2C (El Diferenciador)

- [x] Implementar vista de escaneo de QR: verificar si la mesa tiene una `sesiones_mesa` en estado "Activa" o crear una nueva.
- [x] Desarrollar menú digital Mobile-First renderizado desde el servidor (RSC).
- [x] Crear Store global con Zustand (`features/comanda/store.ts`) para manejar las selecciones temporales de cada comensal (carrito local).
- [x] Implementar suscripción a Supabase Realtime: al enviar el carrito a la comanda general, guardar los *snapshots* en la DB y emitir un evento WebSocket a la sala.
- [x] Integrar escucha de eventos WebSocket para que todos los dispositivos en la misma mesa actualicen su UI en vivo.
- [x] Añadir acciones rápidas: "Llamar al mozo" y "Pedir cuenta" conectadas al monitor de la Épica 3.

### Épica 5: Pagos e Integraciones (Mercado Pago)

- [ ] Crear bóveda segura en el panel admin para almacenar credenciales (Access Tokens de producción) de Mercado Pago de cada restaurante.
- [ ] Implementar Server Action B2C para generar la Preferencia de Pago Dinámica (Checkout Pro) y redirigir al comensal.
- [ ] Desplegar Supabase Edge Functions para escuchar los Webhooks (IPN) de Mercado Pago sin latencias de *cold start*.
- [ ] Configurar lógica del Webhook: Verificar firma HMAC, actualizar estado del pedido a "Pagado", liberar la mesa y emitir evento Realtime de éxito.
- [ ] Implementar Mercado Pago Preapproval para automatizar el cobro del fee mensual del SaaS a los dueños de los locales (B2B).

### Épica 6: Optimización y Funciones Premium

- [ ] Configurar variables de entorno y dominios comodín en Vercel para producción.
- [ ] Optimizar imágenes del menú (`next/image`) e implementar políticas de revalidación de caché (ISR).
- [ ] (Premium) Integrar SDK de IA Multimodal para que el dueño del restaurante pueda hacer consultas en lenguaje natural sobre sus ventas.

```

```
