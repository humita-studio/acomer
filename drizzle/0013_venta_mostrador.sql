-- Venta de mostrador: una sesión sin mesa para cobros rápidos en barra/caja.
-- Reusa toda la maquinaria de sesiones_mesa (pedidos, ítems, ítem libre, cobros),
-- igual que takeaway/delivery, pero sin datos de entrega. Sólo hace falta permitir
-- el nuevo valor 'mostrador' en el tipo de sesión (el código del dashboard ya lo
-- contempla como canal).
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0013_venta_mostrador.sql

ALTER TABLE sesiones_mesa DROP CONSTRAINT IF EXISTS sesiones_mesa_tipo_check;--> statement-breakpoint
ALTER TABLE sesiones_mesa ADD CONSTRAINT sesiones_mesa_tipo_check CHECK (tipo IN ('salon','takeaway','delivery','mostrador'));
