-- ============================================================================
-- PRODUCTO_VARIANTES (presentaciones de un plato, elección única y precio fijo):
-- DDL + RLS + AUDIT.
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0015_producto_variantes.sql
--
-- Archivo autocontenido (DDL + RLS + audit), mismo criterio que 0011_promociones.sql.
-- fn_audit_log y get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
--
-- Modelo: un producto es "de precio único" (productos_precios) O "con variantes"
-- (producto_variantes, cada una con su precio absoluto en producto_variantes_precios).
-- Al pedir, la variante elegida se guarda en comanda_items.variante_id y su nombre/
-- precio caen en los snapshots ya existentes; el producto_id se conserva para que
-- reportes y promos sigan roleando al plato base.
-- ============================================================================

-- Presentaciones de un plato: "Simple", "Napolitana", "A caballo", "Doble caballo".
-- Elección única y requerida cuando el producto tiene al menos una variante activa.
CREATE TABLE producto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  es_default boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);--> statement-breakpoint

CREATE INDEX idx_producto_variantes_producto ON producto_variantes(producto_id) WHERE deleted_at IS NULL;--> statement-breakpoint

-- Precio absoluto de cada variante (ledger append-only, igual que productos_precios).
CREATE TABLE producto_variantes_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  variante_id uuid NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
  precio numeric(10,2) NOT NULL,
  vigente_desde timestamptz DEFAULT now(),
  vigente_hasta timestamptz,
  creado_por uuid
);--> statement-breakpoint

CREATE INDEX idx_producto_variantes_precios_vigente ON producto_variantes_precios(variante_id) WHERE vigente_hasta IS NULL;--> statement-breakpoint

-- La variante elegida en cada línea de comanda / borrador. Nullable: productos sin
-- variantes y los ítems libres no la usan. SET NULL para no romper el snapshot
-- histórico si algún día se borra la variante (el nombre/precio ya están copiados).
ALTER TABLE comanda_items ADD COLUMN variante_id uuid REFERENCES producto_variantes(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE items_borrador_mesa ADD COLUMN variante_id uuid REFERENCES producto_variantes(id) ON DELETE SET NULL;--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (defensa en profundidad para el acceso vía PostgREST/anon;
-- `db` corre con rol dueño y BYPASSA RLS).
-- ============================================================================
ALTER TABLE producto_variantes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE producto_variantes_precios ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "producto_variantes_select" ON producto_variantes FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_insert" ON producto_variantes FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_update" ON producto_variantes FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_delete" ON producto_variantes FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

CREATE POLICY "producto_variantes_precios_select" ON producto_variantes_precios FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_precios_insert" ON producto_variantes_precios FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_precios_update" ON producto_variantes_precios FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "producto_variantes_precios_delete" ON producto_variantes_precios FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; ambas tablas tienen id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_producto_variantes AFTER INSERT OR UPDATE OR DELETE ON producto_variantes FOR EACH ROW EXECUTE FUNCTION fn_audit_log();--> statement-breakpoint
CREATE TRIGGER tr_audit_producto_variantes_precios AFTER INSERT OR UPDATE OR DELETE ON producto_variantes_precios FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
