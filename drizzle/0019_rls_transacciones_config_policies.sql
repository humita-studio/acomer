-- ============================================================================
-- RLS: políticas faltantes para transacciones_pago y configuracion_pagos
-- ============================================================================
-- Estas dos tablas tenían RLS habilitado pero CERO políticas, lo que bajo un
-- rol sin BYPASSRLS (el que usa `withTenant`) equivale a "denegar todo". Sin
-- estas políticas, cualquier lectura/escritura de cobros o de configuración de
-- pagos ejecutada con RLS activo devolvería 0 filas / fallaría.
--
-- Se escopan por restaurant_id contra get_current_restaurant_id(), que resuelve
-- el tenant desde los claims inyectados por withTenant (request.jwt.claims).

-- transacciones_pago -------------------------------------------------------
DROP POLICY IF EXISTS "transacciones_pago_select" ON transacciones_pago;
--> statement-breakpoint
CREATE POLICY "transacciones_pago_select" ON transacciones_pago
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "transacciones_pago_insert" ON transacciones_pago;
--> statement-breakpoint
CREATE POLICY "transacciones_pago_insert" ON transacciones_pago
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "transacciones_pago_update" ON transacciones_pago;
--> statement-breakpoint
CREATE POLICY "transacciones_pago_update" ON transacciones_pago
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "transacciones_pago_delete" ON transacciones_pago;
--> statement-breakpoint
CREATE POLICY "transacciones_pago_delete" ON transacciones_pago
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

-- configuracion_pagos ------------------------------------------------------
DROP POLICY IF EXISTS "configuracion_pagos_select" ON configuracion_pagos;
--> statement-breakpoint
CREATE POLICY "configuracion_pagos_select" ON configuracion_pagos
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "configuracion_pagos_insert" ON configuracion_pagos;
--> statement-breakpoint
CREATE POLICY "configuracion_pagos_insert" ON configuracion_pagos
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "configuracion_pagos_update" ON configuracion_pagos;
--> statement-breakpoint
CREATE POLICY "configuracion_pagos_update" ON configuracion_pagos
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "configuracion_pagos_delete" ON configuracion_pagos;
--> statement-breakpoint
CREATE POLICY "configuracion_pagos_delete" ON configuracion_pagos
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());
