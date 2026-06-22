-- ============================================================================
-- PROMOS APLICADAS: snapshot de TODAS las promociones de una transacción
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0014_promos_aplicadas.sql
--
-- promocion_id sólo guarda UNA promo (queda NULL cuando aplican 2+), así que se
-- perdía el detalle cuando se acumulaban varias. Esta columna guarda el snapshot
-- completo [{ id, nombre, tipo, descuento }] al momento del cobro: sobrevive
-- aunque después se edite o borre la promo, y habilita reportes por promoción.
-- ============================================================================

ALTER TABLE "transacciones_pago" ADD COLUMN IF NOT EXISTS "promociones_aplicadas" jsonb NOT NULL DEFAULT '[]'::jsonb;
