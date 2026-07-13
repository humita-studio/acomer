# Kit de venta — piloto acomer

Checklist para **cerrar 1–5 locales a mano** sin billing self-serve.
Usalo en demos, onboarding y handoff al dueño.

---

## 1. Pitch en 30 segundos

> acomer es el sistema operativo del local: carta digital por QR, pedidos a
> cocina en vivo, mesas, takeaway/delivery, reservas y cobros con Mercado Pago
> — todo en un solo panel.

**No digas (por ahora):** multi-sucursal, API, “14 días gratis automáticos”,
límites de mesas del plan Básico (no se aplican en el producto).

**Precios:** de referencia en la landing; el plan se cierra con vos (transferencia /
acuerdo).

---

## 2. Demo en vivo (15–20 min)

### Setup (antes de la call)

- [ ] Tenant de demo con menú real (fotos + precios)
- [ ] ≥ 4 mesas con QR
- [ ] Mercado Pago de prueba o real vinculado
- [ ] Caja abierta en el panel
- [ ] Pedidos online y/o reservas activos si los vas a mostrar
- [ ] Celular + laptop (comensal + staff)

### Guión

| Min | Qué mostrar | Dónde |
| --- | --- | --- |
| 0–2 | Landing + registro (subdominio del local) | `acomer.com.ar` |
| 2–5 | Checklist primer día del panel | `/admin` |
| 5–8 | Menú: alta rápida / import CSV | `/admin/menu` |
| 8–12 | Plano + QR + pedido desde el celular → cocina | Mesas + `/mesa/…` + Cocina |
| 12–14 | Cobro MP o efectivo + cobros/caja | Pagar + `/admin/cobros` + Caja |
| 14–16 | Venta de mostrador | Botón **Nueva venta** |
| 16–18 | Pedido online o reserva (uno de los dos) | `/pedir` o `/reservar` |
| 18–20 | Reportes del día | Dashboard / Reportes |

### Frases que cierran

- “El comensal no descarga app: escanea y pide.”
- “Cocina, salón y caja miran lo mismo en tiempo real.”
- “Mercado Pago es de **su** cuenta; acomer no se queda con el cobro del plato.”

---

## 3. Onboarding de un local real (día 1)

Orden recomendado (el checklist del dashboard lo guía):

1. **Menú** — al menos 8–10 productos (o import CSV)
2. **Mesas** — crear salón + imprimir QRs (`Generar QR` → Imprimir todos)
3. **Mercado Pago** — vincular en Configuración → Pagos
4. **Caja** — abrir turno con fondo inicial
5. **Probar** — un pedido de mesa de punta a punta
6. **Staff** — invitar mozo/cocina (contraseña temporal; al entrar cambian clave)
7. **Online / reservas** — activar solo si los van a usar esa semana

Criterio de “listo”:

> Dueño solo, &lt; 45 min: registra → menú → mesas → MP → pedido de mesa → cobro visible en caja.

---

## 4. Qué probar con plata real (staging / local amigo)

Antes del go-live del cliente:

- [ ] Mesa: pedir → cocina → MP success
- [ ] Mesa: MP cancelado/fallido → reintento
- [ ] Mesa: efectivo → aparece en Cobros → aprobar → caja
- [ ] Mostrador: efectivo con vuelto
- [ ] Mostrador: QR MP
- [ ] Online: takeaway hasta seguimiento
- [ ] Reserva: entra pendiente → confirmar → sentar mesa
- [ ] Cerrar caja: contado vs esperado

Webhook MP: URL pública + `MP_WEBHOOK_SECRET` en Vercel (ver `DEPLOY.md`).

---

## 5. Comercial

### Oferta piloto sugerida

- Setup asistido (1 h remota o presencial)
- Mes de prueba o mes incluido
- Precio de referencia: Básico / Pro de la landing
- Soporte por WhatsApp / email que **vos** atiendas

### No prometer

- Multi-sucursal, API, facturación AFIP, app de repartidor
- SLA 99,9 % sin contrato
- Soporte 24/7 si no lo podés cumplir

### Documentos

- TyC: `/terminos`
- Privacidad: `/privacidad`
- El registro exige aceptar ambos

---

## 6. Operación tuya (post-venta)

| Tarea | Frecuencia |
| --- | --- |
| Revisar logs Vercel si reportan “pagué y no cerró” | Bajo demanda |
| Confirmar MP OAuth + webhook del local | En el setup |
| Backup: export manual de reportes si lo piden | Mensual |
| Feedback del local → roadmap | Semanal |

Sentry: **opcional**. Sin cuenta, usá logs de Vercel.

---

## 7. Comandos útiles

```bash
# Dev
bun run dev

# Tests unitarios
bun run test

# Smoke e2e (tenant demo por defecto)
bun run test:e2e

# E2E contra otro local
PLAYWRIGHT_TENANT_URL=http://mi-local.localhost:3000 bun run test:e2e
```

Deploy y DNS: `DEPLOY.md`.

---

## 8. Checklist pre-demo (1 minuto)

- [ ] Prod / preview estable
- [ ] Tenant demo con menú y mesas
- [ ] MP conectado (o mock solo en dev)
- [ ] Caja abierta
- [ ] Celular con datos / misma red Wi‑Fi
- [ ] Link del local anotado (`slug.acomer…`)
