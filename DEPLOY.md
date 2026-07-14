# Deploy — acomer

Guía para desplegar en **Vercel** con **Cloudflare** como DNS, usando **subdominios wildcard**
para que cada restaurante (tenant) funcione automáticamente **sin agregarlo a mano**.

---

## Cómo funciona el multi-tenant

Cada restaurante vive en su propio subdominio:

```
pizzeria.acomer.com.ar  → tenant "pizzeria"
elbodegon.acomer.com.ar → tenant "elbodegon"
acomer.com.ar           → dominio principal (landing / registro)
```

El archivo [`proxy.ts`](./proxy.ts) intercepta cada request, extrae el slug del
subdominio y reescribe internamente la ruta a `app/[tenant]/...`. La URL del navegador
no cambia.

> **La clave del wildcard:** al configurar `*.acomer.com.ar` una sola vez, **cualquier**
> subdominio nuevo entra automáticamente al `proxy.ts` y resuelve su tenant. No hace falta
> tocar Vercel ni Cloudflare cuando se registra un restaurante nuevo. El alta de un tenant
> es solo un registro en la base de datos (vía `/register`).

---

## 1. Vercel — Dominios

En **Project → Settings → Domains**, agregá **dos** entradas:

| Dominio | Para qué |
|---|---|
| `acomer.com.ar` | Dominio principal (landing, registro, login, `/admin`) |
| `*.acomer.com.ar` | **Wildcard** — todos los tenants, sin agregarlos uno por uno |

Vercel va a pedir que verifiques la titularidad del dominio (un registro `TXT`) y emite
automáticamente el certificado SSL, **incluido el wildcard** `*.acomer.com.ar`.

---

## 2. Cloudflare — DNS

En **Cloudflare → DNS → Records**:

| Tipo | Nombre | Destino | Proxy |
|---|---|---|---|
| `CNAME` | `acomer.com.ar` (`@`) | `cname.vercel-dns.com` | ⚪ **DNS only** |
| `CNAME` | `*` | `cname.vercel-dns.com` | ⚪ **DNS only** |

### ⚠️ Importante: poné el proxy en **DNS only** (nube gris)

Si dejás el 🟠 proxy naranja de Cloudflare activo sobre los registros de Vercel, vas a
tener doble CDN y problemas de SSL (errores `525` / `526`), y el plan free de Cloudflare
**no cubre SSL wildcard** de sub-subdominios. Con **DNS only**:

- Cloudflare solo resuelve el DNS.
- Vercel maneja SSL (incluido el wildcard) y CDN.

> Si más adelante querés el proxy naranja de Cloudflare sí o sí, vas a necesitar un plan
> con *Wildcard SSL* y poner el modo SSL en **Full (strict)**. Para empezar, **DNS only**
> es lo recomendado y lo más simple.

---

## 3. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | Dominio principal que usa `proxy.ts` para separar tenant de dominio raíz | `acomer.com.ar` |
| `NEXT_PUBLIC_APP_URL` | URL pública base de la app (callbacks de pago, etc.) | `https://acomer.com.ar` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon) de Supabase | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Clave secreta de Supabase (server-side, bypassa RLS) | `sb_secret_...` |
| `DATABASE_URL` | Connection string de Postgres (pooler de Supabase) | `postgresql://...:6543/postgres` |
| `NEXT_PUBLIC_MP_CLIENT_ID` | Client ID de Mercado Pago Connect (OAuth) | `5430330461934441` |
| `MP_CLIENT_SECRET` | Client secret de Mercado Pago | `...` |
| `MP_WEBHOOK_SECRET` | Secret de firma de webhooks MP (panel → Webhooks → `x-signature`) | `...` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary (subida de fotos del local) | `mi-cloud` |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary (firma de uploads) | `123456789012345` |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary (**solo server**) | `...` |
| `ALLOW_PAYMENT_MOCK` | (Opcional) `true` para habilitar el simulador de pagos fuera de dev | solo si hace falta demo forzada |
| `MP_BILLING_ACCESS_TOKEN` | Access token de la cuenta MP de **acomer** (cobra suscripciones SaaS) | `APP_USR-…` o `TEST-…` |
| `MP_PLATFORM_ACCESS_TOKEN` | Alias opcional de `MP_BILLING_ACCESS_TOKEN` | |

> **No commitees secretos.** El `.env` local no debe subirse al repo; cargá estos valores
> directamente en el panel de Vercel.
>
> En **producción** el proveedor mock de pagos (del local) está deshabilitado salvo
> `ALLOW_PAYMENT_MOCK=true`.
>
> **Billing SaaS:** el local paga a acomer con Checkout Pro usando
> `MP_BILLING_ACCESS_TOKEN`. Webhook: `https://acomer.com.ar/api/webhooks/billing/mp`
> (misma firma `MP_WEBHOOK_SECRET` si la app es la misma). Migración:
> `drizzle/0026_billing.sql`.
>
> Pilotos sin cobro: en SQL
> `UPDATE restaurantes SET billing_status = 'exempt' WHERE slug = '…';`

---

## 4. Supabase Auth — redirect URLs

En **Supabase → Authentication → URL Configuration**, agregá a *Redirect URLs*:

| URL | Para qué |
|---|---|
| `https://acomer.com.ar/auth/callback` | Recovery de contraseña y magic links |
| `http://localhost:3000/auth/callback` | Dev local |

El form de “olvidé mi contraseña” redirige a  
`/auth/callback?next=/cambiar-password`.

---

## 5. Verificación

Una vez propagado el DNS (puede tardar unos minutos):

1. `https://acomer.com.ar` → landing / registro.
2. Registrá un restaurante de prueba en `/register` (ej. slug `pizzeria`).
3. `https://pizzeria.acomer.com.ar/carta` → debe resolver el tenant **sin haber tocado
   Vercel ni Cloudflare**. Si funciona, el wildcard está OK.

---

## Notas

- **Dominios `*.vercel.app`** (deploys de preview, ej. `acomer-pvnh.vercel.app`) se tratan
  como dominio principal en `proxy.ts` — ahí **no** se pueden probar subdominios de tenant,
  porque Vercel no resuelve subdominios arbitrarios sin dominio custom. Para probar tenants
  por subdominio: usá el dominio real, o probá en local con `pizzeria.localhost:3000`.
- El alta de un tenant es un registro en la base (`/register`), no una operación de infra.
