-- ============================================================================
-- LANDING CONFIG (home pública del local): DDL + RLS + AUDIT
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0017_landing_config.sql
--
-- Archivo autocontenido (DDL + RLS + audit), aplicado fuera del journal de
-- drizzle-kit — mismo criterio que 0008 (reservas_config) y 0009 (delivery).
-- fn_audit_log y get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
-- ============================================================================

-- Configuración de la landing 1:1 con el restaurante: descripción, dirección,
-- horarios de atención por día, qué acciones se ofrecen, color de marca y redes.
-- Si no hay fila, la app usa sus defaults (features/landing/landingConfig.ts).
CREATE TABLE landing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurantes(id) ON DELETE CASCADE,
  descripcion text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  -- 7 días indexados por getDay() (0=Dom … 6=Sáb): { cerrado, desde, hasta }.
  horarios jsonb NOT NULL DEFAULT '[
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"},
    {"cerrado": false, "desde": "12:00", "hasta": "00:00"}
  ]'::jsonb,
  acciones jsonb NOT NULL DEFAULT '{"verCarta": true, "pedirOnline": true, "reservar": true, "qr": true}'::jsonb,
  color_marca text NOT NULL DEFAULT 'terracota',
  redes jsonb NOT NULL DEFAULT '{"whatsapp": "", "instagram": "", "telefono": ""}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT landing_config_color_marca_check CHECK (color_marca IN ('terracota','ambar','verde'))
);--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (mismo patrón que 0008: filtra por restaurant_id del JWT)
-- ============================================================================
ALTER TABLE landing_config ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "landing_config_select" ON landing_config FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "landing_config_insert" ON landing_config FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "landing_config_update" ON landing_config FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "landing_config_delete" ON landing_config FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- NOTA: la landing pública lee la config vía la conexión `db` (DATABASE_URL),
-- que corre con un rol dueño de tabla y BYPASSA RLS — igual que la carta y el
-- form de reservas. Estas policies aplican al acceso vía PostgREST/anon, como
-- defensa en profundidad.

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; la tabla tiene id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_landing_config AFTER INSERT OR UPDATE OR DELETE ON landing_config FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
