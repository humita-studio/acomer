-- ============================================================================
-- MESAS: mozo asignado (sector / responsable del servicio)
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0024_mesa_mozo_asignado.sql
-- ============================================================================

ALTER TABLE "mesas"
  ADD COLUMN IF NOT EXISTS "mozo_user_id" uuid;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mesas_mozo_user_id_idx"
  ON "mesas" USING btree ("restaurant_id", "mozo_user_id");
