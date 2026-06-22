-- ============================================================================
-- RESERVAS CONFIG: turnos con nombre/rango + anticipación mínima.
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0016_reservas_config_turnos.sql
--
-- Archivo autocontenido, mismo criterio que 0008_reservas_config.sql.
--
-- Cambia el modelo de `turnos` de una lista plana de 'HH:MM' a una lista de
-- turnos con nombre y rango horario ({ nombre, desde, hasta, activo }) y agrega
-- `anticipacion_min_min` (anticipación mínima en minutos para poder reservar).
-- RLS y el trigger de audit ya existen para esta tabla (0008).
-- ============================================================================

-- Nueva columna: anticipación mínima (min). 0 = sin mínimo.
ALTER TABLE reservas_config
  ADD COLUMN IF NOT EXISTS anticipacion_min_min integer NOT NULL DEFAULT 120;--> statement-breakpoint

-- Default del nuevo modelo de turnos (almuerzo + cena).
ALTER TABLE reservas_config
  ALTER COLUMN turnos SET DEFAULT '[
    {"nombre":"Almuerzo","desde":"12:00","hasta":"15:30","activo":true},
    {"nombre":"Cena","desde":"20:00","hasta":"00:00","activo":true}
  ]'::jsonb;--> statement-breakpoint

-- Migra filas existentes que todavía tengan el shape viejo (array de strings)
-- al nuevo default. La conversión de horarios sueltos a rangos con nombre es
-- heurística, así que adoptamos el default; el dueño puede ajustarlo luego.
UPDATE reservas_config
SET turnos = '[
    {"nombre":"Almuerzo","desde":"12:00","hasta":"15:30","activo":true},
    {"nombre":"Cena","desde":"20:00","hasta":"00:00","activo":true}
  ]'::jsonb
WHERE jsonb_typeof(turnos) = 'array'
  AND (jsonb_array_length(turnos) = 0 OR jsonb_typeof(turnos->0) = 'string');
