-- ============================================================================
-- ZONA DE ENTREGA (delivery_config) + LANDING MÁS PERSONALIZABLE
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0027_delivery_zona_landing.sql
--
-- delivery: zona (texto), costo fijo, pedido mínimo, tiempo estimado.
-- landing: texto "sobre el local", logo, más colores de marca.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- delivery_config: reglas de envío
-- ---------------------------------------------------------------------------
ALTER TABLE delivery_config
  ADD COLUMN IF NOT EXISTS zona_entrega text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS costo_envio numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedido_minimo numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_estimado_min integer;

-- ---------------------------------------------------------------------------
-- landing_config: contenido + logo + paleta ampliada
-- ---------------------------------------------------------------------------
ALTER TABLE landing_config
  ADD COLUMN IF NOT EXISTS sobre text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_public_id text NOT NULL DEFAULT '';

-- Ampliar colores de marca (drop + recreate del check).
ALTER TABLE landing_config DROP CONSTRAINT IF EXISTS landing_config_color_marca_check;
ALTER TABLE landing_config ADD CONSTRAINT landing_config_color_marca_check
  CHECK (color_marca IN (
    'terracota', 'ambar', 'verde', 'azul', 'bordo', 'negro', 'rosa', 'indigo'
  ));
