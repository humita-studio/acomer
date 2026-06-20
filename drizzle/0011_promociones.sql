-- ============================================================================
-- PROMOCIONES (descuentos y combos): DDL + RLS + AUDIT
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0011_promociones.sql
--
-- Archivo autocontenido (DDL + RLS + audit), mismo criterio que 0006/0007/0008.
-- fn_audit_log y get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
-- ============================================================================

-- Una promoción del restaurante.
--   tipo:     porcentaje | monto_fijo | 2x1 | combo
--   valor:    % (porcentaje), $ (monto_fijo), precio del combo (combo); 2x1 = 0
--   alcance:  pedido | categoria | producto  (a qué se aplica el descuento)
--   target_ids: ids de categoría/producto involucrados (combo = lista de productos)
--   condiciones jsonb: { soloEfectivo, metodosPago[], dias[0-6], horaDesde, horaHasta,
--                        canales[], montoMinimo }  — vacío = sin condición
CREATE TABLE promociones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  alcance text NOT NULL DEFAULT 'pedido',
  target_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  condiciones jsonb NOT NULL DEFAULT '{}'::jsonb,
  vigente_desde timestamptz,
  vigente_hasta timestamptz,
  activa boolean NOT NULL DEFAULT true,
  prioridad integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promociones_tipo_check CHECK (tipo IN ('porcentaje','monto_fijo','2x1','combo')),
  CONSTRAINT promociones_alcance_check CHECK (alcance IN ('pedido','categoria','producto'))
);--> statement-breakpoint

CREATE INDEX idx_promociones_restaurant ON promociones(restaurant_id) WHERE activa;--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (filtra por restaurant_id del JWT; `db` (DATABASE_URL)
-- corre con rol dueño y BYPASSA RLS — estas policies son defensa en profundidad
-- para el acceso vía PostgREST/anon).
-- ============================================================================
ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "promociones_select" ON promociones FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "promociones_insert" ON promociones FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "promociones_update" ON promociones FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "promociones_delete" ON promociones FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; la tabla tiene id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_promociones AFTER INSERT OR UPDATE OR DELETE ON promociones FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
