# Auditoría técnica — 4 de septiembre de 2026

Revisión completa del proyecto para responder una pregunta: **¿acomer ya se puede
poner en manos de clientes reales?**

Respuesta corta: **sí para pilotos acompañados** (1–5 locales que vos mismo
onboardeás), con la lista corta de pendientes de la sección 4 resuelta antes del
primer cobro real. El producto es sólido: build, tipos, tests y smoke e2e pasan;
la base tiene RLS en las 34 tablas y el schema de Drizzle está alineado con la
base real; los flujos públicos (carta, QR de mesa, pedidos online, reservas,
opiniones) y el panel (dashboard, cocina, mesas, cobros, staff, configuración)
cargan sin errores.

---

## 1. Qué se verificó

| Chequeo | Resultado |
| --- | --- |
| `bun run typecheck` | OK |
| `bun run lint` | OK (antes: 24 errores + 18 warnings; ahora 0 errores, 1 warning cosmético) |
| `bun run test` | 19 archivos, 103 tests OK |
| `bun run test:e2e` (Playwright smoke) | 15 OK, 1 skipped (el local demo estaba cerrado por horario) |
| `bun run build` (producción) | OK, 40 rutas |
| Base (Supabase, `dktesqdpxenxktyvsmww`) | RLS activo en 34/34 tablas; schema.ts = columnas reales; 4 locales, 5 usuarios, 335 productos |
| Navegación real (Chrome) | Landing, `/carta`, `/pedir`, `/mesa/<qr>`, `/reservar`, `/opinar`, `/admin` (dashboard, cocina, mesas, cobros, pedidos online, staff, configuración) |

Lo que **no** se pudo ejercitar en esta sesión: el checkout de delivery con GPS
(el local demo estaba cerrado por horario), un OAuth real de Mercado Pago y un
webhook de pago real. Ver sección 5 para probarlos a mano.

---

## 2. Corregido en esta sesión

### Seguridad

1. **Secuestro de cobros vía OAuth de Mercado Pago (crítico).**
   `app/api/webhooks/pagos/mp-oauth/route.ts` guardaba la cuenta MP sobre el
   restaurante que venía en `state`, sin autenticación. Cualquiera podía armar el
   link de vinculación con el id de otro local y quedarse con todos sus cobros
   online. Ahora el callback exige sesión de dueño/admin, guarda sólo sobre el
   restaurante de esa sesión y rechaza si `state` no coincide (`error=state_mismatch`).
2. **"Desactivar local" desde `/platform` no hacía nada.** `getTenantBySlug` y
   `getTenantDetails` ignoraban `restaurantes.activo`. Ahora un local inactivo
   (o borrado) no resuelve para el público: carta, QR, pedidos, reservas y
   opiniones devuelven "Local no encontrado".
3. **Copiloto IA:** rate limit por usuario (40 consultas / 10 min; cada consulta
   llama a Gemini) y permiso para pausar/activar platos (antes cualquier rol
   podía).
4. **Cabeceras de seguridad** en `next.config.ts`: `X-Frame-Options`,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### Robustez

5. **Lookups de usuarios de Auth** (`invite-employee`, `listEmployees`,
   `listMozosAction`): usaban `auth.admin.listUsers({ perPage: 1000 })` y
   filtraban en memoria; dejaba de encontrar gente a partir del usuario 1001 y
   traía toda la plataforma en cada llamada. Ahora consultan `auth.users` por
   email / ids (`features/auth/authUsers.ts`).
6. **Índices faltantes** (migración `drizzle/0031_indices_fk.sql`, **pendiente
   de aplicar**, ver sección 4): `productos`, `categorias`, `perfiles_empleados`,
   etc. no tenían índice por `restaurant_id`; los joins por `pedido_id`,
   `sesion_mesa_id`, `producto_id` tampoco. Con pocos locales no se nota; con
   volumen cada carta pública era un scan completo.
7. **Cobros:** las tarjetas mostraban `Mesa 55f6a6bb-…` (UUID) o `Mesa Desconocida`
   para mostrador/retiro/envío. Ahora muestran `Mesa 12`, `Mostrador`, `Retiro en
   local` o `Delivery`.
8. **Build más limpio:** `getCurrentSession` / `getPlatformSession` ya no tragan
   el error `DYNAMIC_SERVER_USAGE` de Next (lo logueaban como fallo de sesión en
   cada build).

### Calidad de código (lint del React Compiler)

9. 24 errores de `react-hooks/set-state-in-effect` y `react-hooks/refs`
   corregidos con los patrones recomendados (ajuste de estado durante el render,
   handlers de evento, refs sincronizadas en efecto, estado derivado): panel de
   mesas, stepper/rotación del plano, diálogo de prompt, cocina (sync con el
   server component), campana de notificaciones (lista derivada + leídos),
   checkout online (tipo/GPS), sheet de delivery, mapa de zona, diálogo de asignar
   mesa. Más 18 warnings de imports sin uso.

---

## 3. Riesgos conocidos que quedan (con criterio)

| Riesgo | Impacto | Recomendación |
| --- | --- | --- |
| ~~Canales Realtime públicos~~ **Resuelto en fase 3:** canales siempre privados + políticas (0032 aplicada). Queda un clic manual: Supabase → Realtime → Settings → "Private channels only". | — | Activar "Private channels only". |
| **Rate limit en memoria** (`shared/lib/rateLimit.ts`). En Vercel cada instancia tiene su propio contador. | Bajo | Aceptable para pilotos; a escala, Upstash/Redis. |
| **Webhook MP sin `MP_WEBHOOK_SECRET`** sigue procesando (con warning). Igual verifica el pago contra la API de MP con el token del local y compara montos. | Bajo | Setear el secret en prod (sección 4). |
| **Un perfil por usuario.** `getCurrentSession` toma el primer `perfiles_empleados`; un mismo email en dos locales cae en uno arbitrario. | Bajo hoy | Documentado; multi-local es roadmap. |
| **Migraciones sin tracking.** No existe `drizzle.__drizzle_migrations`; se aplican a mano con `scripts/apply-migration.mjs`. | Medio operativo | Llevar un registro (aunque sea una tabla `migraciones_aplicadas`) antes de sumar más entornos. |
| **Dockerfile instala con `npm install`** aunque el lockfile es `bun.lock`: versiones no determinísticas en Docker. Vercel no lo usa. | Bajo | `oven/bun` para `install`/`build` si Docker importa. |
| **Latencia DB.** Desde Argentina cada server action tarda ~2 s (170 ms por round-trip a `us-east-2`). En prod las funciones corren en `iad1`, al lado de la base: OK. | Sólo dev | Nada que hacer en prod; en dev, esperar esos tiempos. |
| **Datos de prueba en el local `demo`:** pedidos online "en curso" de hace 50–70 días. | Cosmético | Limpiar antes de una demo comercial. |

---

## 4. Pendientes antes del primer cliente de pago

- [x] Migraciones 0031 (índices) y 0032 (Realtime privado) aplicadas el 2026-09-04.
- [ ] Supabase → Realtime → Settings → "Private channels only".
- [ ] **Commit + deploy de la fase 3.** El código en prod (HEAD) tiene el bug del login (el proxy redirige el POST de la server action y el formulario muestra "No se pudo iniciar sesión" aunque la sesión exista).
- [ ] En Vercel: `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_ROOT_DOMAIN=acomer.com.ar`, `NEXT_PUBLIC_APP_URL=https://acomer.com.ar` (hoy `.env` local tiene `ROOT_DOMAIN` comentado; en dev está bien).
- [ ] Sacar la credencial en texto plano que quedó comentada en `.env` (línea `# Email: … Contraseña: …`). El archivo no se commitea, pero no debería vivir ahí.
- [ ] Redirect URI de la app de MP = `https://acomer.com.ar/api/webhooks/pagos/mp-oauth` (el callback ahora exige que el dueño esté logueado en ese navegador).
- [ ] Si se habilita cobro SaaS: `MP_BILLING_ACCESS_TOKEN` + `BILLING_COBRO_HABILITADO = true`.
- [ ] Probar a mano lo de la sección 5.

---

## 5. Pruebas manuales recomendadas (lo que no cubrió esta sesión)

1. **Checkout delivery con mapa** (`/pedir` con el local abierto): abrir el checkout en modo Envío → debe decir "Detectando tu ubicación…", pedir permiso de GPS, marcar el pin y rellenar la dirección; cambiar a Retiro y volver a Envío; cerrar y reabrir el sheet. (Componente refactorizado en esta sesión.)
2. **Campana de notificaciones:** con dos pestañas (comensal en `/mesa/<qr>` y panel), enviar un pedido y llamar al mozo → toast + badge; abrir la campana → badge en 0; recargar → no reaparecen las ya vistas.
3. **Cocina:** avanzar una card mientras llega un pedido nuevo (el estado optimista no debe pisarse).
4. **OAuth MP real:** Configuración → Pagos → Vincular; al volver debe decir "Cuenta vinculada". Probar también el link con otro `state` → `error=state_mismatch`.
5. **Un cobro real chico** por MP desde una mesa y verificar el webhook en los logs de Vercel.

---

## 7. Fase 2 — operación en vivo (misma fecha, segunda pasada)

Foco: tiempos de carga, realtime, notificaciones, sesiones compartidas, mozo,
mesas y delivery. Medido con `DEBUG_SQL=1 bun run dev` (loguea cada query) y
con un script de latencia contra Supabase.

### Qué se midió

| Métrica | Valor |
| --- | --- |
| Round-trip a Postgres desde Argentina (pooler 6543) | ~170 ms por statement |
| `withTenant` antes / después (BEGIN + set role + claims + query + COMMIT) | ~860 ms → ~690 ms |
| Supabase Auth `getUser()` (HTTP) | 180–440 ms por llamada |
| Realtime REST broadcast | ~65 ms |
| Prod (Vercel): funciones en `iad1`, base en `us-east-2` | misma costa: OK |
| Prod TTFB público (`/carta`, `/pedir`, landing del local) | 0,6–1,8 s |

En producción la región está bien; el costo dominante era **una llamada HTTP a
Auth por cada request y por cada server action** (páginas, polls de la campana,
cada click del mozo). Desde acá se ve como 2 s por acción; en Vercel eran
100–400 ms fijos que se pagaban siempre.

### Corregido

1. **Auth sin HTTP:** `getCurrentSession`, `getPlatformSession`, el proxy y el
   post-login verifican el JWT localmente con `auth.getClaims()` (el proyecto
   firma con clave asimétrica ES256; `shared/supabase/claims.ts`). Sólo va a
   Supabase cuando hay que refrescar el token. `CambiarPasswordForm` refresca
   la sesión al cambiar la clave para que el claim `must_change_password`
   viaje actualizado.
2. **Wrapper RLS más barato:** `withTenant` / `withPublicTenant` setean rol y
   claims en un solo statement (`set_config('role', …)`), un round-trip menos por
   llamada. Verificado que RLS sigue aplicando (0 filas ajenas visibles).
3. **Campana:** un solo poll (alertas + caja) cada 30 s en vez de dos server
   actions cada 20 s en todas las pantallas; escucha `caja_actualizada` para
   refrescar al instante.
4. **Realtime unificado:** todos los avisos del servidor salen por
   `broadcastAdminEvent` / `broadcastMesaEvent` (`shared/supabase/broadcast.ts`,
   cliente admin + `httpSend`). Antes cada action armaba su propio
   `channel.send()` con la sesión del caller, que hoy cae a REST con un warning
   de deprecación. Los avisos de Cobros se emiten **después** del commit (antes
   iban dentro de la transacción y el comensal podía refrescar antes de ver el
   pago).
5. **Listeners muertos del comensal:** `ResumenPago` y `RealtimeMesaSync` usaban
   `postgres_changes` sobre `transacciones_pago` y `pedidos`, tablas que **no
   están en la publicación de Realtime** (sólo `items_borrador_mesa`): nunca
   llegaba nada. El ticket "cuenta solicitada" quedaba congelado hasta recargar
   cuando el cajero aprobaba o rechazaba. Ahora escuchan broadcasts de la sesión
   (`pago_completado`, `pago_actualizado`, `sesion_cerrada`, …) y el cajero
   emite `pago_actualizado` al rechazar.
6. **Etiquetas de mesa:** "Mesa Mesa 12" en el QR, la campana, el plano, los QR
   impresos y las reservas; y **UUIDs** en el ticket del comensal y en Cobros.
   Helper único `shared/lib/mesaLabel.ts` (`etiquetaMesa`,
   `etiquetaOrigenSesion`).
7. **Delivery:** totales con `formatPeso` ("$ 23.500") en vez de `$23500.00`.
8. **Mozo sin mesas asignadas:** entraba al plano filtrado en "Mis mesas" y veía
   "este ambiente todavía no tiene mesas". Ahora arranca en "Todas" si no tiene
   asignadas, y el vacío por filtro ofrece "Ver todas las mesas".
9. **/admin/mesas:** ambiente por defecto y plano en paralelo; se eliminó una
   query redundante del slug (ya viene en la sesión).
10. **Tenant:** `getTenantBySlug` reutiliza `getTenantDetails` (cache por
    request): una query menos en cada página pública.
11. `DEBUG_SQL=1` para loguear queries en dev (`shared/db/client.ts`).
12. **Precio visto ≠ precio cobrado (crítico).** Las herramientas de precios del
    Copiloto (`actualizarPrecioPlato`, `ajustarPreciosMasivo`, `pausarOActivarPlato`)
    escribían en la base sin invalidar la carta pública cacheada
    (`unstable_cache`, tag `carta-<tenant>`): el comensal veía $10.300 y el
    pedido se snapshoteaba a $15.450 (detectado en la prueba en vivo). Ahora
    invalidan el tag y `/admin/menu`, igual que las acciones del menú.
13. **"Una mesa pidió la cuenta" al aprobar un cobro.** Aprobar/rechazar un
    cobro y agregar productos a una cuenta pendiente emitían `cuenta_solicitada`
    (para refrescar Cobros), y la campana lo mostraba como si un comensal
    hubiera pedido la cuenta. Nuevo evento silencioso `cobro_actualizado`
    (Cobros, Caja y Dashboard lo escuchan); `cuenta_solicitada` queda sólo para
    pedidos reales del comensal.
14. **Cocina:** la espera de una comanda vieja decía "666 min"; ahora "11 h 06".
15. **QR de mesa:** sub-mesas y sesión activa se leen en paralelo (un round-trip
    menos al escanear).
16. Tests nuevos para `etiquetaMesa` / `etiquetaOrigenSesion` y `getVerifiedUser`
    (113 tests en total).
17. **Carta cacheada con TTL de 10 min** (`obtenerCarta`): red de seguridad para
    que una mutación que olvide invalidar no deje precios viejos a la vista para
    siempre (el local demo tenía la carta desactualizada desde el ajuste masivo
    del Copiloto).
18. **Texto del carrito online:** decía "Esto manda a cocina. Para la cuenta,
    usá Pagar arriba" también en takeaway/delivery, donde el botón es
    "Finalizar pedido" y no hay "Pagar arriba". Ahora: "Después elegís retiro o
    envío, tus datos y cómo pagar."

### Prueba en vivo (dos pestañas, local demo)

Comensal en el QR de la Mesa 12 → agrega un Fernet → "Confirmar pedido":

- Cocina recibió la comanda **en vivo** (sin recargar), la pasó a "Cocinando".
- Comensal → Pagar → Efectivo → "Un mozo se acerca a tu mesa para cobrar".
- Cobros → Aprobar cobro → la pantalla del comensal pasó sola a "¡Pago
  exitoso!" con el widget de opinión (antes quedaba congelada).
- Etiquetas correctas en todo el recorrido ("Mesa 12", no "Mesa Mesa 12" ni UUID).

Pedido online (con el local ya abierto, 20:00): `/pedir` → Fernet → "Finalizar
pedido" → checkout (Retiro en local, nombre, teléfono) → "Confirmar pedido":

- El pedido se creó (sesión takeaway, `datos_entrega` en Recibido) y el modal de
  pago se abrió in-place; con Efectivo pasó a la pantalla de seguimiento
  ("Pedido tomado · pago pendiente · Pagar ahora").
- Cocina recibió la comanda de retiro **en vivo** junto a la de salón.
- Lo que no pude cerrar: mover la tarjeta a "En preparación" desde el tablero
  de pedidos online y ver el seguimiento avanzar. La ventana de Chrome quedó en
  segundo plano y el renderer se congeló antes de que la acción llegara al
  servidor; el camino servidor → comensal es el mismo que ya se probó con la
  mesa (broadcast + `router.refresh`). Probarlo a mano: tablero → menú de la
  tarjeta → "Marcar como en preparación" → el seguimiento debe pasar a "Lo
  estamos cocinando" sin recargar.

### Verificado en esta pasada

- Typecheck, lint (0 errores), 103 tests, 15 e2e.
- Navegación real con sesión: dashboard, mesas, cobros, cocina, pedidos online,
  staff, configuración; QR de mesa, carta, landing del local, opiniones.
- Broadcast servidor → cliente probado con un script (los tres métodos llegan).

### Observaciones de prod (no tocadas)

- El apex `acomer.com.ar` responde con `Server: cloudflare` (proxy naranja) y
  los subdominios con `Server: Vercel` (DNS only). `DEPLOY.md` pide DNS only en
  ambos; el proxy en el apex suma latencia y puede dar 525/526.
- Los pedidos online "en curso" del local demo tienen 50–70 días: limpiar antes
  de una demo.

## 8. Fase 3 — reservas, mostrador/caja, Realtime y roles (misma fecha)

### Reservas (probado de punta a punta en el local demo)

Online → Pendiente → Confirmar → Sentar (abre la mesa) → liberar la mesa →
la reserva pasa sola a **Cumplida**. Corregido en el camino:

1. **Zona horaria (bug real en producción).** El servidor corre en UTC y el
   cupo por día y el turno (Almuerzo/Cena) se calculaban con `getHours()` /
   `setHours()`: una reserva a las 21:00 caía en el día siguiente y en el turno
   equivocado. Además el formulario público construía el instante con la zona
   del teléfono del comensal. Nuevo helper `shared/lib/zonaHoraria.ts`
   (`instanteEnZona`, `partesEnZona`, `inicioDelDiaEnZona`) usado por el
   formulario público, el alta manual del admin y el cálculo de cupo. Con tests.
2. **Reservas sentadas para siempre.** Al pagar o liberar la mesa nadie las
   cerraba: `shared/reservas/reservasSesion.ts` (`marcarReservasCumplidas`) se
   llama al cerrar la sesión desde Cobros, el webhook de MP y "Liberar mesa".
3. Horario ya pasado: se rechaza aunque el local no exija anticipación.
4. La agenda se refresca en otras pestañas al confirmar/asignar/sentar
   (evento `reserva_actualizada`).
5. Pantalla final del comensal distingue "¡Reserva confirmada!" (auto-confirmar
   activo) de "¡Reserva enviada!". Etiqueta "Mesa Mesa 12" en la tarjeta.

### Venta de mostrador y caja (probado en vivo)

- Efectivo con vuelto ($20.000 sobre $15.450 → vuelto $4.550), comanda al KDS.
- Mercado Pago: QR y link reales generados; al cancelar, la venta y la comanda
  quedan canceladas. **Nuevo:** el KDS se entera en vivo (antes esperaba el
  poll de 30 s con una comanda fantasma).
- Cierre de caja con arqueo sin diferencia y reapertura. La caja del demo quedó
  abierta con $1.000.000 como estaba.
- "−$ 0" en el historial de cierres (redondeo de centavos): `formatPeso` y la
  diferencia tratan |x| < 0,5 como cero.

### Realtime

- **Bug encontrado:** supabase-js devuelve el mismo canal para el mismo topic.
  La campana (layout), el plano, cocina, cobros, caja y dashboard compartían
  `admin_restaurant_<id>` sin saberlo: al salir de una pantalla, su
  `removeChannel` le cortaba la suscripción a la campana hasta recargar.
  Ahora todo pasa por `shared/supabase/realtime.ts` (un canal por topic,
  handlers por evento, refcount, `useBroadcast` / `subscribeBroadcast` /
  `sendBroadcast`). Con tests. Verificado en vivo navegando Mesas → Cocina
  por el cliente: el pedido nuevo llegó a cocina y a la campana.
- **Canales privados:** migración `drizzle/0032_realtime_private_channels.sql`
  (políticas en `realtime.messages`: staff activo lee/escribe su
  `admin_restaurant_*`; `mesa_*` abierto a anon) + flag
  que la app ahora usa siempre (los canales se abren `private: true`; el flag
  de rollout se eliminó una vez aplicada la migración).
  **Aplicada en la base real** (junto con 0031, que ya estaba) y verificada:
  función `es_staff_del_canal` (security definer), 4 políticas, RLS activo en
  `realtime.messages`. Probado en vivo con canales `private: true` desde Node:
  el comensal anónimo entra a `mesa_*` y manda/recibe broadcast; un mozo
  activo entra a `admin_restaurant_<demo>`, manda/recibe, y NO entra al canal
  de otro local; nadie sin perfil activo entra (ni anónimo ni un mozo
  desactivado: "Unauthorized"). El flag sigue apagado hasta terminar el rollout.

### Roles

- `/admin/menu` y `/admin/mesas` no tenían guard de sección: cualquier rol
  entraba por URL (las acciones sí validaban). Ahora redirigen a
  `/unauthorized` como el resto.
- Recorrido automático con Playwright como mozo, cocina y cajero (login con
  clave temporal → cambio de clave → 15 rutas del panel + `/platform`).
  Resultado final: los tres roles entran, caen en su pantalla (cajero → Caja,
  mozo → Mesas, cocina → Cocina), el sidebar muestra solo lo suyo y toda ruta
  ajena termina en `/unauthorized`. Cero errores de consola. En el camino
  aparecieron cuatro bugs reales:
  - **Login del staff roto.** Tras `signInWithPassword`, el formulario llamaba a
    la server action que resuelve el destino; el proxy veía un POST a `/login`
    con usuario ya logueado y lo redirigía (307) → la acción fallaba → "No se
    pudo iniciar sesión" con la sesión ya creada. Arreglo doble: el proxy no
    redirige POSTs de server actions (`next-action`) y, tras el login o el
    cambio de clave, se navega con carga completa (`window.location.assign`)
    en lugar de `router.push` + `router.refresh` (el refresh pisaba el push y
    el usuario quedaba en `/login`).
  - **Redirects de autorización en streaming.** Cada página hacía
    `redirect('/unauthorized')` dentro de su `Suspense` (y bajo
    `app/admin/loading.tsx`), así que Next lo emitía en streaming. En Next 16
    eso dio 500 intermitentes en SSR (`Tooltip must be used within
    TooltipProvider`, ~1 de cada 3 pedidos) y "Rendered more hooks" al hidratar.
    Ahora `app/admin/layout.tsx` autoriza por ruta antes de emitir HTML
    (`seccionDeRutaAdmin` + `rutaInicialAdmin` en `features/authorization/roles.ts`,
    con tests): 307 limpio. Los chequeos por página quedan como defensa.
  - **Hidratación rota en Cocina, Cobros, Reservas y Pedidos online.** Dos
    causas: `toLocaleTimeString` en 12 h ("10:13 p. m.") separa distinto en
    Node y en Chrome → `formatHora` pasa a 24 h (`22:13`); y dnd-kit numera sus
    ids de accesibilidad con un contador global → `id` fijo en los cuatro
    `DndContext`. Además `features/reservas/fechas.ts` calculaba hora y día con
    la zona del proceso: en Vercel (UTC) las reservas de la noche caían en el
    día siguiente y con otra hora; ahora usa `partesEnZona`.
  - **Hidratación en el seguimiento del pedido online** (misma causa de hora).
- **Los 500 de SSR son solo de dev.** El mismo síntoma apareció después en
  `/pedir` ("No QueryClient set") durante el e2e, justo tras recompilar. Para
  descartarlo en producción levanté el build standalone (`next build` +
  `node .next/standalone/server.js`, puerto 3001) y lo martillé: 8 rondas ×
  14 rutas en paralelo como mozo y como comensal, 112 pedidos, cero errores y
  ningún 500. Es Turbopack en dev duplicando módulos al recompilar (los
  contextos de React dejan de coincidir). Igual la autorización desde el layout
  queda: evita el redirect en streaming, que es lo que lo disparaba.
- Falso positivo descartado: en dev, tipear antes de que hidrate el formulario
  de login deja los inputs controlados vacíos y Supabase responde 400; en prod
  hidrata en milisegundos. No se tocó.
- Cuentas de prueba `auditoria-{mozo,cocina,cajero}@acomer.test` desactivadas
  al terminar.

## 9. Fase 4 — alta autónoma (2026-09-05)

Objetivo: que un dueño se registre y opere sin que nadie de acomer lo acompañe.
Recorrido real con Playwright como usuario nuevo (local de prueba
`parrilla-auditoria`, borrable): registro en 3 pasos → dashboard con checklist →
categoría y producto → mesa en el plano → QR → caja → invitar mozo → el comensal
escanea el QR (subdominio), pide y el pedido cae en Cocina. Todo funcionó; lo que
no cerraba:

- **La carta pública mostraba vacío después de cargar el primer producto.** Las
  server actions del menú invalidaban con `revalidateTag(tag, 'default')`, que en
  Next 16 es stale-while-revalidate: la primera visita sirve la versión vieja.
  Ahora usan `updateTag` (expira al instante, pensado para "ver mi propio
  cambio"). El Copiloto sigue con `revalidateTag` porque corre en un route
  handler. Verificado: producto nuevo → visible en la primera visita.
- **La landing ofrecía "Pedir online" y "Reservar" con esos canales apagados**
  (dos callejones sin salida para el cliente). La landing ahora muestra cada
  tarjeta solo si su canal está prendido, además del toggle propio. Verificado:
  al activar pedidos online y reservas, las tarjetas aparecen solas.
  El default de `acciones` en el código no coincidía con el de la base (la base
  ya tenía todo `true`); se alineó el código.
- **Mercado Pago era paso obligatorio del checklist**: un local que cobra solo en
  caja nunca llegaba a "listo". Pasa a opcional (sigue tercero, con copy que
  aclara que efectivo y tarjeta funcionan sin MP). Con lo obligatorio completo,
  el checklist pasa a una tarjeta chica con lo opcional pendiente (cerrable) en
  lugar de desaparecer del todo. `/admin/configuracion?tab=pagos` abre directo
  la pestaña de pagos.
- **Reservas → "Activar online"** abría la configuración con el switch apagado;
  ahora abre con "Aceptar reservas web" prendido, solo falta guardar.
- **Recuperar contraseña e invitar por email dependían de un SMTP que no hay**
  (el de Supabase solo entrega al equipo del proyecto): el form decía "Revisá tu
  email" y no llegaba nada. Decisión del usuario: dejarlo afuera por ahora. Los
  dos flujos quedan detrás de `NEXT_PUBLIC_AUTH_EMAIL_HABILITADO` (apagado):
  `/forgot-password` explica cómo recuperar la clave (staff → el dueño genera
  una temporal; dueño → soporte) y el invite solo ofrece contraseña temporal.
  Cómo prenderlo con Resend, en `CONFIGURAR.md`.

Lo que está bien y no toqué: wizard de registro claro, estados vacíos con CTA
en todas las secciones, import de menú por foto/PDF con IA o CSV, QR con
"Copiar link", contraseña temporal para el staff, `*.localhost` resuelve en el
navegador para probar subdominios en dev.

Pendiente de esta fase: el toast "Caja cerrada" aparece en cada carga completa
aunque el local esté en setup (ruido menor); limpiar el tenant de prueba
`parrilla-auditoria` cuando termine la auditoría.

### Responsive (misma fecha, en paralelo)

Recorrido en 1920, 1440, 1280, 1024, 820 y 390 px de 14 rutas del panel, las
públicas y los diálogos principales, midiendo scroll horizontal, elementos fuera
del viewport y targets táctiles chicos. Ningún body con scroll horizontal; las
públicas y la comanda del comensal bien en 390. Arreglado:

- **Menú en 390: tabla rota** (columnas fijas sumaban más que el ancho; el
  nombre del producto quedaba en 0 px). Categoría se oculta bajo `md` y pasa a
  subtítulo del nombre; Precio/Disp. más angostas en mobile.
- **Plano de mesas ilegible bajo 1280** (se encogía hasta celdas de 8 px). La
  celda mínima sube a 14 px y el lienzo panea en horizontal en vez de encogerse;
  el panel "Avisos en vivo" pasa a la derecha recién en `xl`.
- **Plano bloqueaba el scroll táctil** (`touch-none` siempre): ahora solo en
  modo editar, que es donde dnd-kit lo necesita.
- Targets chicos en 390: botones de categoría y "Copiar link" del QR.

No tocado: tamaño del `Switch` compartido en mobile (decisión de design
system), sidebar expandido en tablet 820 (mejora: `collapsible="icon"` entre
768 y 1024).

### Optimistic updates (misma fecha, en paralelo)

Inventario de mutaciones del panel y la comanda. Ya eran optimistas con
rollback: cocina, cobros, pedidos online, menú, comanda del comensal, ticket del
mozo y plano. Pasaron a optimistas ahora (ms desde el click hasta que la UI lo
refleja, en dev contra us-east-2):

| Mutación | Antes | Después |
| --- | --- | --- |
| Staff: desactivar / activar | 3.9 s / 3.4 s | 79 / 59 ms |
| Mesas: asignar mozo | 3.8 s | 32 ms |
| Reservas: sentar / confirmar | 5.7 s / ~3.5 s | 35 / 74 ms |
| Promociones: pausar / eliminar | (server) | optimista, no medido |

Siguen server-bound a conciencia: abrir/cerrar caja (la acción no devuelve la
sesión creada), "Confirmar pedido" del comensal (avisar "enviado a cocina" antes
de que cocina lo tenga sería mentir) y las altas que necesitan id del server
(ya muestran pending). Riesgo conocido: un broadcast que llegue entre el
`onMutate` y la respuesta puede mostrar el estado viejo unos ms.

### Pasada de textos (2026-09-05)

Inventario de todo el texto visible (panel, diálogos, páginas públicas) con
Playwright, más rastreo de inglés y jerga en el código. Criterio: palabras del
dueño de un restaurante, no del que programó. Cambios:

- Inglés residual de los componentes compartidos: "Toggle Sidebar" y "Close"
  (lectores de pantalla y tooltips) → "Abrir o cerrar el menú", "Cerrar".
- Jerga fuera: "Landing" → "Página pública" (pestaña, descripciones), "hero" →
  "portada", "Tagline" → "Descripción corta", "Mercado Pago (OAuth)" → "Mercado
  Pago", "Gemini 3.8 Flash" → "la IA", Cloudinary/WebP/AVIF desaparecen de los
  textos de carga de imágenes, "Autosave"/"Snap"/"handle" en el plano →
  "Se guarda solo", "Grilla", "el punto de arriba rota". "click" → "clic".
- Roles en español con una sola fuente (`ETIQUETA_ROL`): el sidebar decía
  "Panel De Owner"; ahora "Panel de dueño" y "Dueño" (decisión: Dueño, no
  Propietario). Sidebar: "Dashboard" → "Inicio" (decisión del usuario).
- Atajo del Copiloto: "⌘J" solo en Mac; en Windows/Linux "Ctrl+J".
- Reseñas: título "Gestión de Reseñas & Google Maps" con badge "Filtro
  Inteligente Activo" y copy de folleto → "Reseñas", "Filtro activo" y una línea
  que dice qué hace. Ídem la tarjeta de configuración y el feed.
- Consistencia: "Takeaway" → "Retiro" en promociones y etiquetas de pedidos
  (igual que Pedidos online); "Top productos" → "Más vendidos"; "Distribución
  por canal" → "por medio de pago"; plurales ("1 mesa", no "1 mesas"); "Horario
  de hoy: Hoy 12:00–00:00" ya no repite "hoy".
- Flujo: la pestaña Pagos mostraba un selector "Proveedor activo" con una sola
  opción y su botón "Guardar preferencia"; en producción se oculta (queda solo
  en dev, donde existe el simulador).
- Toast "Caja cerrada": una vez por sesión de navegador (decisión del usuario);
  sigue fijo en la campana. El diálogo de Nueva venta no tenía título accesible.

No tocado a conciencia: "Copiloto IA", "link" (uso corriente en Argentina),
"Delivery" (idem), los textos legales.

## 6. Archivos tocados

Seguridad: `app/api/webhooks/pagos/mp-oauth/route.ts`, `features/tenant/get-tenant.ts`,
`app/api/copilot/route.ts`, `features/copilot/copilotTools.ts`, `next.config.ts`.
Robustez: `features/auth/authUsers.ts` (nuevo), `features/auth/invite-employee.ts`,
`features/mesas/mesas-actions.ts`, `features/cobros/*`, `drizzle/0031_indices_fk.sql` (nuevo),
`features/auth/session.ts`, `features/platform/session.ts`.
Fase 3: `proxy.ts`, `features/auth/components/{LoginForm,CambiarPasswordForm}.tsx`,
`app/admin/{layout,page}.tsx`, `app/admin/staff/page.tsx`, `features/authorization/roles.ts` (+ test),
`shared/supabase/realtime.ts` (nuevo, + test) y los 12 consumidores de Realtime,
`shared/lib/zonaHoraria.ts` (nuevo, + test), `shared/reservas/reservasSesion.ts` (nuevo),
`features/reservas/{fechas,reservasActions}.ts`, `shared/lib/format.ts`,
`drizzle/0032_realtime_private_channels.sql` (nuevo, sin aplicar).
Lint/React: `features/notificaciones/components/StaffNotifications.tsx`,
`features/pedidos-online/components/CheckoutExterno.tsx`, `features/cocina/components/CocinaManager.tsx`,
`features/mesas/components/{mesa-panel,plano-stepper,plano-rotation-control}.tsx`,
`features/pedidos-online/components/DeliveryConfigSheet.tsx`, `shared/maps/ZonaEntregaMapa.tsx`,
`features/reservas/components/AsignarMesaDialog.tsx`, `shared/ui/prompt-dialog.tsx` y varios imports.
