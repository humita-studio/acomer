# Plan de Desarrollo: SaaS Multi-Tenant para Restaurantes

Este documento detalla la hoja de ruta completa para la construcción de la plataforma de gestión de restaurantes, carta digital interactiva y comandas compartidas. 

**Stack Tecnológico:**
* **Frontend & Routing:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
* **Gestión de Estado:** Zustand (Cliente), TanStack Query / Server Actions (Servidor/Caché).
* **Base de Datos & Auth:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions).
* **ORM:** Drizzle ORM (Optimizado para entornos Edge y consultas seguras con RLS).
* **Infraestructura:** Vercel (Hosting, Edge Middleware para subdominios).
* **Pagos:** Mercado Pago (Checkout Pro y Suscripciones).

---

## 📂 Arquitectura de Carpetas (Feature-Sliced Design)

```text
├── src/
│   ├── app/                      # Solo enrutamiento y middleware
│   │   ├── (landing)/            # tuapp.com
│   │   ├── admin/                # app.tuapp.com
│   │   └── [tenant]/             # pizzeria.tuapp.com (Middleware rewrite)
│   ├── features/                 # Lógica de negocio aislada
│   │   ├── auth/                 # Autenticación y gestión de usuarios
│   │   ├── tenant/               # Resolución de inquilinos y configuración del local
│   │   ├── menu/                 # Catálogo, platos, modificadores, historial de precios
│   │   ├── comanda/              # Lógica de QR, Zustand store, Supabase Realtime
│   │   └── pagos/                # Integración Mercado Pago, Webhooks
│   └── shared/                   # Código genérico
│       ├── db/                   # Instancia Drizzle, Schemas, migraciones
│       ├── ui/                   # Componentes base (shadcn)
│       └── utils/                # Helpers, formateadores
└── middleware.ts                 # Next.js Edge Middleware para *.tuapp.com



