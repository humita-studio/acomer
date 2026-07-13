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

En **local**, `NEXT_PUBLIC_ROOT_DOMAIN` puede ser `localhost:3000`.  
Tenants de prueba: `http://demo.localhost:3000` (el browser resuelve `*.localhost`).

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
3. **Webhooks** de pagos del local (Checkout del comensal):
   ```
   https://acomer.com.ar/api/webhooks/pagos/mercado_pago?tenantId=<uuid>
   ```
   En la app, la `notification_url` se arma sola con el `tenantId` del local.  
   En el panel MP a veces configurás una URL base; lo importante es que las notificaciones lleguen y que `MP_WEBHOOK_SECRET` coincida con el secret de firma.

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
| `drizzle/0026_billing.sql` | Schema de billing |

---

*Última actualización alineada al billing self-serve (trial 3 meses + Checkout Pro SaaS).*
