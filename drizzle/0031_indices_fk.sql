-- Índices para las FKs más consultadas. Antes de esta migración `productos`,
-- `categorias`, `perfiles_empleados`, etc. no tenían índice por `restaurant_id`
-- (cada carta pública era un scan completo de la tabla) y los joins por
-- `pedido_id` / `sesion_mesa_id` / `producto_id` tampoco.
-- Todos con IF NOT EXISTS: es seguro re-aplicarla.
--
-- Aplicar con:  node scripts/apply-migration.mjs drizzle/0031_indices_fk.sql

-- Carta / menú
CREATE INDEX IF NOT EXISTS "productos_restaurant_id_idx" ON "productos" ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_categoria_id_idx" ON "productos" ("categoria_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categorias_restaurant_id_idx" ON "categorias" ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_precios_producto_vigente_idx" ON "productos_precios" ("producto_id") WHERE "vigente_hasta" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modificadores_restaurant_id_idx" ON "modificadores" ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modificadores_precios_modificador_vigente_idx" ON "modificadores_precios" ("modificador_id") WHERE "vigente_hasta" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "producto_modificadores_disponibles_producto_id_idx" ON "producto_modificadores_disponibles" ("producto_id");
--> statement-breakpoint

-- Pedidos / comandas
CREATE INDEX IF NOT EXISTS "pedidos_sesion_mesa_id_idx" ON "pedidos" ("sesion_mesa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_items_pedido_id_idx" ON "comanda_items" ("pedido_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_item_modificadores_comanda_item_id_idx" ON "comanda_item_modificadores" ("comanda_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_borrador_mesa_sesion_mesa_id_idx" ON "items_borrador_mesa" ("sesion_mesa_id");
--> statement-breakpoint

-- Mesas / sesiones
CREATE INDEX IF NOT EXISTS "sesiones_mesa_mesa_activa_idx" ON "sesiones_mesa" ("mesa_id") WHERE "estado" = 'Activa';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mesas_ambiente_id_idx" ON "mesas" ("ambiente_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mesas_parent_mesa_id_idx" ON "mesas" ("parent_mesa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ambientes_restaurant_id_idx" ON "ambientes" ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "elementos_plano_ambiente_id_idx" ON "elementos_plano" ("ambiente_id");
--> statement-breakpoint

-- Cobros / caja / entregas / reservas
CREATE INDEX IF NOT EXISTS "transacciones_pago_sesion_mesa_id_idx" ON "transacciones_pago" ("sesion_mesa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_caja_id_idx" ON "movimientos_caja" ("sesion_caja_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_caja_restaurant_estado_idx" ON "sesiones_caja" ("restaurant_id", "estado");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "datos_entrega_sesion_mesa_id_idx" ON "datos_entrega" ("sesion_mesa_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservas_mesa_id_idx" ON "reservas" ("mesa_id");
--> statement-breakpoint

-- Staff
CREATE INDEX IF NOT EXISTS "perfiles_empleados_restaurant_id_idx" ON "perfiles_empleados" ("restaurant_id");
