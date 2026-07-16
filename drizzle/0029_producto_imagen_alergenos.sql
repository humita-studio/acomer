-- Fotos y alérgenos en productos; auto-confirm de reservas online.
ALTER TABLE "productos"
  ADD COLUMN IF NOT EXISTS "imagen_url" text,
  ADD COLUMN IF NOT EXISTS "imagen_public_id" text,
  ADD COLUMN IF NOT EXISTS "alergenos" text[] NOT NULL DEFAULT '{}';

ALTER TABLE "reservas_config"
  ADD COLUMN IF NOT EXISTS "auto_confirmar_online" boolean NOT NULL DEFAULT false;
