-- ============================================================================
-- PAGOS ↔ CAJA: cada transacción puede vincularse a la sesión de caja del turno
-- en que se cobró. Nullable para datos históricos y para cobros digitales (MP)
-- hechos con la caja cerrada.
--
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0023_transaccion_sesion_caja.sql
-- ============================================================================

ALTER TABLE "transacciones_pago"
  ADD COLUMN IF NOT EXISTS "sesion_caja_id" uuid;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transacciones_pago_sesion_caja_id_fk'
  ) THEN
    ALTER TABLE "transacciones_pago"
      ADD CONSTRAINT "transacciones_pago_sesion_caja_id_fk"
      FOREIGN KEY ("sesion_caja_id")
      REFERENCES "public"."sesiones_caja"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transacciones_pago_sesion_caja_id_idx"
  ON "transacciones_pago" USING btree ("sesion_caja_id");
