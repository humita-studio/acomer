-- Migration to sync Drizzle state and add indices.
-- Tables like datos_entrega were already in Supabase, so they are omitted here.

CREATE INDEX IF NOT EXISTS "comanda_items_restaurante_created_at_idx" ON "comanda_items" USING btree ("restaurant_id","created_at");
CREATE INDEX IF NOT EXISTS "movimientos_caja_restaurante_created_at_idx" ON "movimientos_caja" USING btree ("restaurant_id","created_at");
CREATE INDEX IF NOT EXISTS "pedidos_restaurante_created_at_idx" ON "pedidos" USING btree ("restaurant_id","created_at");
CREATE INDEX IF NOT EXISTS "sesiones_mesa_restaurante_created_at_idx" ON "sesiones_mesa" USING btree ("restaurant_id","created_at");
CREATE INDEX IF NOT EXISTS "transacciones_pago_restaurante_created_at_idx" ON "transacciones_pago" USING btree ("restaurant_id","created_at");