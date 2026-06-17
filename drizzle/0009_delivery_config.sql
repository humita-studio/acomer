-- ============================================================================
-- DELIVERY CONFIG (modalidades + agregados): DDL + RLS + AUDIT
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0009_delivery_config.sql
--
-- Archivo autocontenido (DDL + RLS + audit), aplicado fuera del journal de
-- drizzle-kit — mismo criterio que 0006/0007/0008.
-- fn_audit_log y get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
-- ============================================================================

-- Config de pedidos online 1:1 con el restaurante: qué modalidades ofrece y
-- hasta cuándo el cliente puede sumar productos a un pedido ya confirmado.
CREATE TABLE delivery_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurantes(id) ON DELETE CASCADE,
  activo boolean NOT NULL DEFAULT true,
  modo text NOT NULL DEFAULT 'ambos' CHECK (modo IN ('ambos','takeaway','delivery')),
  agregados_hasta text NOT NULL DEFAULT 'preparacion' CHECK (agregados_hasta IN ('no','preparacion','listo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (mismo patrón que 0008: filtra por restaurant_id del JWT)
-- ============================================================================
ALTER TABLE delivery_config ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "delivery_config_select" ON delivery_config FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "delivery_config_insert" ON delivery_config FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "delivery_config_update" ON delivery_config FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "delivery_config_delete" ON delivery_config FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- NOTA: los flujos públicos (carta/checkout) leen la config vía la conexión `db`
-- (DATABASE_URL), que corre con un rol dueño de tabla y BYPASSA RLS — igual que
-- la config de reservas. Estas policies aplican al acceso vía PostgREST/anon.

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; la tabla tiene id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_delivery_config AFTER INSERT OR UPDATE OR DELETE ON delivery_config FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
