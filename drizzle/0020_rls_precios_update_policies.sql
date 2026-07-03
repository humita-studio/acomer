-- ============================================================================
-- RLS: políticas UPDATE faltantes en los ledgers de precios
-- ============================================================================
-- productos_precios y modificadores_precios sólo tenían políticas SELECT/INSERT.
-- El código cierra la vigencia de un precio con UPDATE (set vigenta_hsta) al
-- cambiarlo (features/menu/productosActions.ts, modificadoresActions.ts). Bajo
-- un rol sin BYPASSRLS (withTenant), sin política UPDATE ese cierre afectaría
-- 0 filas SIN lanzar error → el precio viejo nunca se cierra. Estas políticas
-- lo habilitan, escopado por tenant.

DROP POLICY IF EXISTS "productos_precios_update" ON productos_precios;
--> statement-breakpoint
CREATE POLICY "productos_precios_update" ON productos_precios
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "modificadores_precios_update" ON modificadores_precios;
--> statement-breakpoint
CREATE POLICY "modificadores_precios_update" ON modificadores_precios
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
