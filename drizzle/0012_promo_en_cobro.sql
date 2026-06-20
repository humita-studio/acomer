-- ============================================================================
-- PROMO EN EL COBRO: descuento aplicado + qué promoción
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0012_promo_en_cobro.sql
--
-- transacciones_pago.monto pasa a ser el total YA con descuento.
-- descuento guarda el monto descontado y promocion_id la promo aplicada
-- (puede ser NULL si fue manual o si la promo se borró después).
-- ============================================================================

ALTER TABLE "transacciones_pago" ADD COLUMN IF NOT EXISTS "descuento" numeric(10,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "transacciones_pago" ADD COLUMN IF NOT EXISTS "promocion_id" uuid;--> statement-breakpoint
ALTER TABLE "transacciones_pago" ADD CONSTRAINT "transacciones_pago_promocion_id_fk" FOREIGN KEY ("promocion_id") REFERENCES "promociones"("id") ON DELETE SET NULL;
