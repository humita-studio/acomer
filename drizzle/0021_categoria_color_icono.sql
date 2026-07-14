-- ============================================================================
-- Categorías: color e icono personalizables
-- ============================================================================
-- Permite que cada categoría del menú tenga un color de la paleta y un icono
-- (nombre de Lucide) para distinguirlas en el admin y en la carta pública.

ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'terracota',
  ADD COLUMN IF NOT EXISTS icono text NOT NULL DEFAULT 'utensils';
