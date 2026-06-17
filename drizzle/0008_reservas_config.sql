-- ============================================================================
-- RESERVAS CONFIG (cupos/turnos): DDL + RLS + AUDIT
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0008_reservas_config.sql
--
-- Archivo autocontenido (DDL + RLS + audit), aplicado fuera del journal de
-- drizzle-kit — mismo criterio que 0006 (caja) y 0007 (reservas/delivery).
-- fn_audit_log y get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
-- ============================================================================

-- Configuración de reservas 1:1 con el restaurante: turnos, duración y cupos.
-- Cupos en NULL = sin límite. Si no hay fila, la app usa sus defaults.
CREATE TABLE reservas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurantes(id) ON DELETE CASCADE,
  activo boolean NOT NULL DEFAULT true,
  turnos jsonb NOT NULL DEFAULT '["12:00","12:30","13:00","13:30","14:00","20:00","20:30","21:00","21:30","22:00"]'::jsonb,
  duracion_min_default integer NOT NULL DEFAULT 90,
  cupo_cubiertos_por_turno integer,
  max_reservas_por_dia integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (mismo patrón que 0007: filtra por restaurant_id del JWT)
-- ============================================================================
ALTER TABLE reservas_config ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "reservas_config_select" ON reservas_config FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_config_insert" ON reservas_config FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_config_update" ON reservas_config FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_config_delete" ON reservas_config FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- NOTA: el form público de reservas lee la config vía la conexión `db`
-- (DATABASE_URL), que corre con un rol dueño de tabla y BYPASSA RLS — igual que
-- getDisponibilidadAction/crearReservaAction hoy. Estas policies aplican al
-- acceso vía PostgREST/anon, como defensa en profundidad.

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; la tabla tiene id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_reservas_config AFTER INSERT OR UPDATE OR DELETE ON reservas_config FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
