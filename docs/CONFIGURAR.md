# Qué tenés que configurar — acomer

Checklist único para poner el producto en marcha (local y producción).  
No es documentación de código: es **lo que vos tenés que hacer en paneles externos**.

Detalle de DNS/Vercel: [DEPLOY.md](../DEPLOY.md)  
Demo comercial: [VENTA-PILOTO.md](./VENTA-PILOTO.md)

---

## Resumen rápido

| Área | ¿Obligatorio para demo? | ¿Obligatorio para cobrar SaaS? |
| --- | --- | --- |
| Supabase (Auth + DB) | Sí | Sí |
| Variables en Vercel / `.env` | Sí | Sí |
| Dominio + wildcard | Sí (prod) | Sí |
| Mercado Pago **del local** (OAuth) | Para demo de cobros del comensal | No |
| Mercado Pago **de acomer** (billing) | No (trial igual anda) | Sí |
| Cloudinary | Solo si subís fotos | No |
| Migración billing `0026` | Sí si usás trial/planes | Sí |
| Migración `0029` (fotos/alérgenos/auto-confirm) | Sí para menú con foto y auto-confirm reservas | No |
| Migración `0031` (índices por `restaurant_id` / FKs) | Recomendada (rendimiento con volumen) | Recomendada |

---

## 1. Supabase

1. Proyecto en [supabase.com](https://supabase.com)
2. **Authentication → URL configuration**
   - Site URL: `https://acomer.com.ar` (o tu dominio)
   - Redirect URLs:
     - `https://acomer.com.ar/auth/callback`
     - `http://localhost:3000/auth/callback`
3. Copiá:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable / anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret / service role → `SUPABASE_SECRET_KEY`
4. **Database → Connection string** (pooler, puerto `6543` recomendado) → `DATABASE_URL`

Auth: el registro y el invite de staff usan Admin API (`email_confirm: true`).  
No hace falta forzar confirmación de email para el flujo actual.

**Emails de Auth (apagados por defecto).** Dos flujos mandan email desde Supabase
Auth: "¿Olvidaste tu contraseña?" (`/forgot-password`) y el invite de staff "Link
por email". El SMTP de cortesía de Supabase solo entrega a los miembros del
proyecto (y 2 por hora), así que mientras no haya SMTP propio esos flujos quedan
escondidos: `/forgot-password` explica cómo recuperar la clave (staff → el dueño
genera una temporal en Empleados; dueño → escribe a `hola@acomer.com.ar`) y el
invite solo ofrece contraseña temporal.

Para prenderlos: (1) SMTP propio en Supabase → Authentication → SMTP Settings
(Resend gratis alcanza: dominio `acomer.com.ar` verificado con SPF/DKIM en
Cloudflare, host `smtp.resend.com`, puerto 465, usuario `resend`, clave = API key,
remitente `no-reply@acomer.com.ar`); (2) en Authentication → URL Configuration
agregar `https://acomer.com.ar/auth/callback` a las Redirect URLs; (3)
`NEXT_PUBLIC_AUTH_EMAIL_HABILITADO=1` en Vercel y `.env`, y redeploy.

---

## 2. Variables de entorno

Cargalas en **Vercel → Settings → Environment Variables** (Production + Preview si hace falta) y en tu `.env` local.

### Core (siempre)

| Variable | Dónde se usa | Ejemplo |
| --- | --- | --- |
| `DATABASE_URL` | Drizzle / Postgres | `postgresql://…:6543/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | `sb_publishable_…` o `eyJ…` |
| `SUPABASE_SECRET_KEY` | Admin Auth, bypass RLS server | `sb_secret_…` o service role |
| `NEXT_PUBLIC_APP_URL` | Callbacks de pago, preferencias MP | `https://acomer.com.ar` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Multi-tenant (`proxy.ts`) | `acomer.com.ar` |
| `PLATFORM_ADMIN_EMAILS` | Panel de plataforma (`/platform`): dueños de acomer | `vos@mail.com,ops@mail.com` |
| `NEXT_PUBLIC_AUTH_EMAIL_HABILITADO` | `1` recién con SMTP propio: muestra "olvidé mi contraseña" e invite por email | apagado por defecto |
| `SENTRY_DSN` | (Opcional) Errores a Sentry si el SDK inyecta `globalThis.Sentry` | `https://…@….ingest.sentry.io/…` |
| `NEXT_PUBLIC_CLOUDINARY_*` / `CLOUDINARY_*` | Fotos de local y **productos** | ver sección Cloudinary |

En **local**, `NEXT_PUBLIC_ROOT_DOMAIN` puede ser `localhost:3000`.  
Tenants de prueba: `http://demo.localhost:3000` (el browser resuelve `*.localhost`).

### Panel de plataforma (ops acomer)

Ruta: **`/platform`** (no confundir con `/admin` = panel del local).

1. Creá un usuario en Supabase Auth (email/password) con el mail del operador.
2. Agregá ese email a `PLATFORM_ADMIN_EMAILS` (coma-separado, case-insensitive) en Vercel y en `.env` local.
3. Redeploy / reiniciá `bun run dev` para que tome el env.
4. Login en `/login` → si el user **no** tiene perfil de local, cae en `/platform`; si también es owner de un local, entra a `/admin` y ve “Panel acomer” en el menú de usuario.

Desde ahí: listar locales, marcar **exempt**, extender trial, cambiar plan/billing, activar/desactivar.  
**No** hace falta fila en `perfiles_empleados` para operar la plataforma.

### Mercado Pago — cobros del **local** al comensal (OAuth)

Cada restaurante vincula **su** cuenta MP desde Configuración → Pagos.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_MP_CLIENT_ID` | App Connect (OAuth) |
| `MP_CLIENT_SECRET` | Intercambio code → token |
| `MP_WEBHOOK_SECRET` | Firma `x-signature` de webhooks |

**App en** [developers.mercadopago.com](https://www.mercadopago.com/developers/panel/app):

1. Creá una aplicación (o usá la de acomer).
2. **Redirect URI** de OAuth:
   ```
   https://acomer.com.ar/api/webhooks/pagos/mp-oauth
   ```
   (en local, si probás OAuth: la misma con tu URL pública tipo ngrok)

   El callback exige que el **dueño/admin esté logueado en ese mismo navegador**
   y que el `state` coincida con su local: si vuelve con `?error=state_mismatch`
   es que el link se abrió con el id de otro restaurante.
3. **Webhooks** (Notificaciones → Webhooks → **Modo productivo**). Es OTRA
   pantalla que la de Redirect URLs; no mezclar las dos direcciones:
   ```
   https://acomer.com.ar/api/webhooks/pagos/mercado_pago
   ```
   Eventos: solo **Pagos**. Guardar y copiar la **Clave secreta** que muestra
   esa pantalla → `MP_WEBHOOK_SECRET` en Vercel.

   Cada pago del comensal ya lleva su propia `notification_url` con el
   `tenantId` del local (`…/mercado_pago?tenantId=<uuid>`), así que la URL del
   panel es un respaldo: sin `tenantId` la ruta responde 200 y la ignora, para
   que Mercado Pago no la marque como fallida ni reintente.

### Mercado Pago — billing **SaaS** (el local te paga a vos)

| Variable | Para qué |
| --- | --- |
| `MP_BILLING_ACCESS_TOKEN` | Access token de la cuenta MP **de acomer** (recibe la suscripción) |
| `MP_PLATFORM_ACCESS_TOKEN` | Alias opcional del anterior |

**Webhook de suscripciones:**

```
https://acomer.com.ar/api/webhooks/billing/mp
```

Usá el mismo `MP_WEBHOOK_SECRET` si es la misma aplicación de MP.

Sin `MP_BILLING_ACCESS_TOKEN`:

- el **trial de 3 meses** igual funciona  
- el botón “Pagar con Mercado Pago” avisa que falta configurar cobro  

### Cloudinary (fotos del local / menú)

| Variable | Pública |
| --- | --- |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Sí |
| `CLOUDINARY_API_KEY` | No |
| `CLOUDINARY_API_SECRET` | No (solo server) |

### Opcionales

| Variable | Default / efecto |
| --- | --- |
| `ALLOW_PAYMENT_MOCK=true` | Habilita simulador de pagos del local fuera de dev (casi nunca en prod) |
| `PLAYWRIGHT_TENANT_URL` | Solo tests e2e |
| `PLAYWRIGHT_BASE_URL` | Solo tests e2e / CI |

---

### Realtime privado

Los canales `admin_restaurant_<id>` y `mesa_<sesion>` se abren siempre como
privados (`shared/supabase/realtime.ts`), y Supabase los autoriza con las
políticas de `drizzle/0032_realtime_private_channels.sql` (aplicada el
2026-09-04): el staff activo del local lee/escribe su canal; los canales de
mesa quedan abiertos porque el id de sesión es el secreto. Sin esa migración
el panel se queda sin eventos en vivo, así que en una base nueva va antes del
primer deploy.

Último cierre, manual: Supabase → Realtime → Settings → "Private channels
only". Hasta ese paso alguien todavía puede unirse a un topic como canal
público (sin políticas), aunque la app ya no lo haga.

## 3. Dominio y deploy (producción)

Ver paso a paso en [DEPLOY.md](../DEPLOY.md).

Checklist corto:

1. **Vercel** → Domains:
   - `acomer.com.ar`
   - `*.acomer.com.ar`
2. **Cloudflare** DNS → **DNS only** (nube gris), no proxy naranja:
   - `@` → `cname.vercel-dns.com`
   - `*` → `cname.vercel-dns.com`
3. Variables de entorno en Vercel (sección 2)
4. Redeploy después de cambiar env

Verificación:

- `https://acomer.com.ar` → landing  
- Registrar un local → `https://slug.acomer.com.ar/carta`  

---

## 4. Base de datos / migraciones

Las migraciones viven en `drizzle/*.sql`.

Billing (plan, trial, `pagos_suscripcion`):

```bash
node scripts/apply-migration.mjs drizzle/0026_billing.sql
```

Índices de rendimiento (auditoría 2026-09-04, idempotente). **Aplicada en la base real el 2026-09-04.**

```bash
node scripts/apply-migration.mjs drizzle/0031_indices_fk.sql
```

Canales privados de Realtime (políticas sobre `realtime.messages`). **Aplicada en la base real el 2026-09-04.** Obligatoria: la app abre todos los canales como privados.

```bash
node scripts/apply-migration.mjs drizzle/0032_realtime_private_channels.sql
```

O pegá el SQL en el SQL Editor de Supabase.

**Locales ya existentes** tras la migración: quedan en trial según el backfill del SQL.  
**Registros nuevos**: plan Pro + `billing_status = trial` (el trial se ignora mientras el cobro esté off).

### Producto free (estado actual)

En `features/billing/plans.ts`:

```ts
export const BILLING_COBRO_HABILITADO = false;
```

Con eso en `false`:

- `evaluateBilling` siempre da `accessOk`, sin banner de pago y sin `maxMesas`
- Landing y `/admin/billing` hablan de gratis, no de Básico vs Pro
- `iniciarPagoSuscripcionAction` rechaza cobros de suscripción

Cuando el cobro SaaS esté listo: poner el flag en `true` y alinear features/límites reales (mesas, reservas, etc.) con el copy.

### Pilotos sin cobro (cuando el flag esté en true)

```sql
UPDATE restaurantes
SET billing_status = 'exempt'
WHERE slug = 'nombre-del-local';
```

Otros estados útiles:

| `billing_status` | Significado |
| --- | --- |
| `trial` | Prueba (usa `trial_ends_at`) |
| `active` | Pagó (usa `period_ends_at`) |
| `past_due` | Vencido / gracia |
| `cancelled` | Cancelado |
| `exempt` | No se cobra (piloto) |

---

## 5. Qué configura cada **dueño de local** (no vos en Vercel)

Después del registro, el checklist del dashboard los guía:

1. **Menú** — productos / import CSV  
2. **Mesas** — plano + imprimir QRs  
3. **Mercado Pago del local** — Configuración → Pagos → Vincular cuenta  
4. **Caja** — abrir turno para cobros en efectivo / mostrador  
5. **Plan de acomer** — `/admin/billing` cuando termine el trial  

Online / reservas: activar en cada módulo si los usan.

---

## 6. Checklist “listo para el primer cliente de pago”

- [ ] Supabase Auth redirect URLs  
- [ ] Env en Vercel (core + MP OAuth + billing token)  
- [ ] DNS wildcard + SSL OK  
- [ ] Migración `0026_billing.sql` aplicada  
- [ ] Webhook billing apuntando a prod  
- [ ] Un local de prueba: registro → trial visible en Plan y facturación  
- [ ] Pago de prueba de suscripción (MP sandbox o monto real chico)  
- [ ] OAuth de un local + un cobro de mesa de prueba  
- [ ] TyC / privacidad accesibles (`/terminos`, `/privacidad`)  

---

## 7. Problemas frecuentes

| Síntoma | Revisar |
| --- | --- |
| Subdominio no resuelve | DNS `*` + dominio wildcard en Vercel; `NEXT_PUBLIC_ROOT_DOMAIN` |
| SSL 525/526 | Cloudflare en **DNS only** |
| “Falta MP_BILLING_ACCESS_TOKEN” | Env de billing en Vercel + redeploy |
| Trial no aparece / columnas faltan | Migración `0026_billing.sql` |
| OAuth MP del local falla | Redirect URI exacta + `NEXT_PUBLIC_APP_URL` HTTPS |
| Webhook no actualiza pago | URL pública, secret de firma, logs de Vercel en `/api/webhooks/...` |
| Recovery de contraseña no vuelve | Redirect `…/auth/callback` en Supabase |
| Mock de pagos en prod | No debería verse; no setear `ALLOW_PAYMENT_MOCK` |

---

## 8. Archivos relacionados

| Archivo | Contenido |
| --- | --- |
| [DEPLOY.md](../DEPLOY.md) | DNS, Vercel, wildcard |
| [docs/VENTA-PILOTO.md](./VENTA-PILOTO.md) | Guión de demo y venta |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Cómo está armado el código |
| [docs/AUDITORIA-2026-09-04.md](./AUDITORIA-2026-09-04.md) | Auditoría pre-clientes: qué se corrigió y qué queda |
| `drizzle/0026_billing.sql` | Schema de billing |

---

*Última actualización alineada al billing self-serve (trial 3 meses + Checkout Pro SaaS).*
