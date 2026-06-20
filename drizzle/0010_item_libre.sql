-- Ítem libre: permitir líneas de comanda sin producto de la carta
-- (venta rápida / mostrador puede cargar algo que no está en el menú).
-- El nombre y el precio ya se snapshotean en comanda_items, así que solo
-- hace falta que producto_id pueda ser NULL.
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0010_item_libre.sql

ALTER TABLE "comanda_items" ALTER COLUMN "producto_id" DROP NOT NULL;
