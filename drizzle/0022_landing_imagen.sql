-- ============================================================================
-- LANDING: imagen de portada del restaurante (Cloudinary)
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0022_landing_imagen.sql
-- ============================================================================

ALTER TABLE landing_config
  ADD COLUMN IF NOT EXISTS imagen_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS imagen_public_id text NOT NULL DEFAULT '';
