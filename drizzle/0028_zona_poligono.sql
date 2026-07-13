-- ============================================================================
-- ZONA DE ENTREGA DIBUJABLE (GeoJSON Polygon en delivery_config)
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0028_zona_poligono.sql
-- ============================================================================

-- Polígono de cobertura: GeoJSON { type: 'Polygon', coordinates: [[[lng,lat],...]] }
-- null = sin zona dibujada (solo texto zona_entrega si hay).
ALTER TABLE delivery_config
  ADD COLUMN IF NOT EXISTS zona_poligono jsonb;

-- Pin del cliente al pedir delivery (opcional; se valida contra el polígono).
ALTER TABLE datos_entrega
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
