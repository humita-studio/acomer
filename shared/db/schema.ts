import {
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ============================================================================
// Core / Tenants
// ============================================================================

export const restaurantes = pgTable(
  'restaurantes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: text('nombre').notNull(),
    slug: text('slug').notNull().unique(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: uniqueIndex('restaurantes_slug_idx').on(table.slug),
  })
)

// ============================================================================
// Auth, Staff y Roles
// ============================================================================

export const perfilesEmpleados = pgTable(
  'perfiles_empleados',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().unique(), // auth.users
    restauranteId: uuid('restaurant_id').notNull(),
    rol: text('rol').notNull(), // owner | admin | cajero | mozo | cocina
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'perfiles_empleados_restaurant_id_fk',
    }).onDelete('cascade'),
    rolCheck: check(
      'perfiles_empleados_rol_check',
      sql`rol IN ('owner','admin','cajero','mozo','cocina')`
    ),
  })
)

// ============================================================================
// Catálogo y Precios (Ledger Append-Only)
// ============================================================================

export const categorias = pgTable(
  'categorias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    nombre: text('nombre').notNull(),
    activo: boolean('activo').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'categorias_restaurant_id_fk',
    }).onDelete('cascade'),
  })
)

export const productos = pgTable(
  'productos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    categoriaId: uuid('categoria_id').notNull(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    permiteAdicionales: boolean('permite_adicionales').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'productos_restaurant_id_fk',
    }).onDelete('cascade'),
    categoriaIdFk: foreignKey({
      columns: [table.categoriaId],
      foreignColumns: [categorias.id],
      name: 'productos_categoria_id_fk',
    }).onDelete('cascade'),
  })
)

export const productosPrecios = pgTable(
  'productos_precios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
    vigenteSde: timestamp('vigente_desde', { withTimezone: true }).defaultNow(),
    vigentaHsta: timestamp('vigente_hasta', { withTimezone: true }),
    creadoPor: uuid('creado_por'),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'productos_precios_restaurant_id_fk',
    }).onDelete('cascade'),
    productoIdFk: foreignKey({
      columns: [table.productoId],
      foreignColumns: [productos.id],
      name: 'productos_precios_producto_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Modificadores (Ingredientes Extras)
// ============================================================================

export const modificadores = pgTable(
  'modificadores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    nombre: text('nombre').notNull(),
    categoria: text('categoria'),
    disponible: boolean('disponible').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'modificadores_restaurant_id_fk',
    }).onDelete('cascade'),
  })
)

export const modificadoresPrecios = pgTable(
  'modificadores_precios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    modificadorId: uuid('modificador_id').notNull(),
    precioExtra: numeric('precio_extra', { precision: 10, scale: 2 }).notNull().default('0'),
    vigenteSde: timestamp('vigente_desde', { withTimezone: true }).defaultNow(),
    vigentaHsta: timestamp('vigente_hasta', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'modificadores_precios_restaurant_id_fk',
    }).onDelete('cascade'),
    modificadorIdFk: foreignKey({
      columns: [table.modificadorId],
      foreignColumns: [modificadores.id],
      name: 'modificadores_precios_modificador_id_fk',
    }).onDelete('cascade'),
  })
)

export const productoModificadoresDisponibles = pgTable(
  'producto_modificadores_disponibles',
  {
    productoId: uuid('producto_id').notNull(),
    modificadorId: uuid('modificador_id').notNull(),
  },
  (table) => ({
    pk: { name: 'producto_modificadores_disponibles_pk', columns: [table.productoId, table.modificadorId] },
    productoIdFk: foreignKey({
      columns: [table.productoId],
      foreignColumns: [productos.id],
      name: 'producto_mod_disponibles_producto_id_fk',
    }).onDelete('cascade'),
    modificadorIdFk: foreignKey({
      columns: [table.modificadorId],
      foreignColumns: [modificadores.id],
      name: 'producto_mod_disponibles_modificador_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Salón y Sesiones (Lógica QR)
// ============================================================================

export const mesas = pgTable(
  'mesas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    identificador: text('identificador').notNull(),
    qrToken: uuid('qr_token').notNull().defaultRandom().unique(),
    // Posición y forma dentro del plano del local (coordenadas en celdas, fraccionarias)
    ambienteId: uuid('ambiente_id').references(() => ambientes.id, { onDelete: 'set null' }),
    posX: real('pos_x').notNull().default(0),
    posY: real('pos_y').notNull().default(0),
    ancho: real('ancho').notNull().default(2),
    alto: real('alto').notNull().default(2),
    forma: text('forma').notNull().default('cuadrada'), // 'redonda' | 'cuadrada'
    capacidad: integer('capacidad').notNull().default(4),
    rotacion: integer('rotacion').notNull().default(0), // 0 | 90 | 180 | 270
    // Cuando la mesa es una sub-mesa temporal (división), apunta a la mesa madre
    parentMesaId: uuid('parent_mesa_id').references((): AnyPgColumn => mesas.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'mesas_restaurant_id_fk',
    }).onDelete('cascade'),
    qrTokenIdx: uniqueIndex('mesas_qr_token_idx').on(table.qrToken),
    formaCheck: check('mesas_forma_check', sql`forma IN ('redonda','cuadrada')`),
  })
)

// ============================================================================
// Plano del local (ambientes y elementos de dibujo)
// ============================================================================

export const ambientes = pgTable(
  'ambientes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    nombre: text('nombre').notNull(), // "Salón", "Patio", "Terraza"
    orden: integer('orden').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'ambientes_restaurant_id_fk',
    }).onDelete('cascade'),
  })
)

export const elementosPlano = pgTable(
  'elementos_plano',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    ambienteId: uuid('ambiente_id').notNull(),
    tipo: text('tipo').notNull().default('pared'), // 'pared' | 'barra' | 'contorno' | 'decoracion'
    posX: real('pos_x').notNull().default(0),
    posY: real('pos_y').notNull().default(0),
    ancho: real('ancho').notNull().default(1),
    alto: real('alto').notNull().default(1),
    rotacion: integer('rotacion').notNull().default(0),
    etiqueta: text('etiqueta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'elementos_plano_restaurant_id_fk',
    }).onDelete('cascade'),
    ambienteIdFk: foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambientes.id],
      name: 'elementos_plano_ambiente_id_fk',
    }).onDelete('cascade'),
    tipoCheck: check(
      'elementos_plano_tipo_check',
      sql`tipo IN ('pared','barra','contorno','decoracion')`
    ),
  })
)

export const sesionesMesa = pgTable(
  'sesiones_mesa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    mesaId: uuid('mesa_id').notNull(),
    estado: text('estado').notNull().default('Activa'), // Activa | Cerrada
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'sesiones_mesa_restaurant_id_fk',
    }).onDelete('cascade'),
    mesaIdFk: foreignKey({
      columns: [table.mesaId],
      foreignColumns: [mesas.id],
      name: 'sesiones_mesa_mesa_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Borrador de Comanda Compartida (Items en carrito antes de confirmar)
// ============================================================================

export const itemsBorradorMesa = pgTable(
  'items_borrador_mesa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    sesionMesaId: uuid('sesion_mesa_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    nombreProducto: text('nombre_producto').notNull(),
    precioUnitario: numeric('precio_unitario', { precision: 10, scale: 2 }).notNull(),
    cantidad: integer('cantidad').notNull().default(1),
    modificadores: jsonb('modificadores').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'items_borrador_mesa_restaurant_id_fk',
    }).onDelete('cascade'),
    sesionMesaIdFk: foreignKey({
      columns: [table.sesionMesaId],
      foreignColumns: [sesionesMesa.id],
      name: 'items_borrador_mesa_sesion_mesa_id_fk',
    }).onDelete('cascade'),
    productoIdFk: foreignKey({
      columns: [table.productoId],
      foreignColumns: [productos.id],
      name: 'items_borrador_mesa_producto_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Comandas (Snapshots Inmutables)
// ============================================================================

export const pedidos = pgTable(
  'pedidos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    sesionMesaId: uuid('sesion_mesa_id').notNull(),
    estado: text('estado').notNull().default('Pendiente'),
    total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
    notas: text('notas'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'pedidos_restaurant_id_fk',
    }).onDelete('cascade'),
    sesionMesaIdFk: foreignKey({
      columns: [table.sesionMesaId],
      foreignColumns: [sesionesMesa.id],
      name: 'pedidos_sesion_mesa_id_fk',
    }).onDelete('cascade'),
  })
)

export const comandaItems = pgTable(
  'comanda_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    pedidoId: uuid('pedido_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    cantidad: numeric('cantidad', { precision: 5, scale: 0 }).notNull().default('1'),
    nombreProductoSnapshot: text('nombre_producto_snapshot').notNull(),
    precioUnitarioSnapshot: numeric('precio_unitario_snapshot', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'comanda_items_restaurant_id_fk',
    }).onDelete('cascade'),
    pedidoIdFk: foreignKey({
      columns: [table.pedidoId],
      foreignColumns: [pedidos.id],
      name: 'comanda_items_pedido_id_fk',
    }).onDelete('cascade'),
    productoIdFk: foreignKey({
      columns: [table.productoId],
      foreignColumns: [productos.id],
      name: 'comanda_items_producto_id_fk',
    }).onDelete('cascade'),
  })
)

export const comandaItemModificadores = pgTable(
  'comanda_item_modificadores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    comandaItemId: uuid('comanda_item_id').notNull(),
    modificadorId: uuid('modificador_id').notNull(),
    nombreModificadorSnapshot: text('nombre_modificador_snapshot').notNull(),
    precioExtraSnapshot: numeric('precio_extra_snapshot', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'comanda_item_mod_restaurant_id_fk',
    }).onDelete('cascade'),
    comandaItemIdFk: foreignKey({
      columns: [table.comandaItemId],
      foreignColumns: [comandaItems.id],
      name: 'comanda_item_mod_comanda_item_id_fk',
    }).onDelete('cascade'),
    modificadorIdFk: foreignKey({
      columns: [table.modificadorId],
      foreignColumns: [modificadores.id],
      name: 'comanda_item_mod_modificador_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Pagos e Integraciones
// ============================================================================

export const configuracionPagos = pgTable(
  'configuracion_pagos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    proveedor: text('proveedor').notNull(), // 'mercado_pago', 'stripe', 'mock'
    credenciales: jsonb('credenciales').notNull().default({}), // access_token, public_key, etc
    activo: boolean('activo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'configuracion_pagos_restaurant_id_fk',
    }).onDelete('cascade'),
  })
)

export const transaccionesPago = pgTable(
  'transacciones_pago',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    sesionMesaId: uuid('sesion_mesa_id').notNull(),
    proveedor: text('proveedor').notNull(),
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
    estado: text('estado').notNull().default('Pendiente'), // Pendiente | Aprobado | Rechazado | Cancelado
    referenciaExterna: text('referencia_externa'), // ID del pago/preferencia en MP
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'transacciones_pago_restaurant_id_fk',
    }).onDelete('cascade'),
    sesionMesaIdFk: foreignKey({
      columns: [table.sesionMesaId],
      foreignColumns: [sesionesMesa.id],
      name: 'transacciones_pago_sesion_mesa_id_fk',
    }).onDelete('cascade'),
  })
)

// ============================================================================
// Auditoría y Logs
// ============================================================================

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    tabla: text('tabla').notNull(),
    registroId: uuid('registro_id').notNull(),
    accion: text('accion'), // INSERT | UPDATE | DELETE
    datosAnteriores: jsonb('datos_anteriores'),
    datosNuevos: jsonb('datos_nuevos'),
    realizadoPor: uuid('realizado_por'),
    realizadoAt: timestamp('realizado_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'audit_log_restaurant_id_fk',
    }).onDelete('cascade'),
    accionCheck: check('audit_log_accion_check', sql`accion IN ('INSERT','UPDATE','DELETE')`),
  })
)

// ============================================================================
// Relations
// ============================================================================

export const restaurantesRelations = relations(restaurantes, ({ many }) => ({
  perfilesEmpleados: many(perfilesEmpleados),
  categorias: many(categorias),
  productos: many(productos),
  productosPrecios: many(productosPrecios),
  modificadores: many(modificadores),
  modificadoresPrecios: many(modificadoresPrecios),
  mesas: many(mesas),
  ambientes: many(ambientes),
  elementosPlano: many(elementosPlano),
  sesionesMesa: many(sesionesMesa),
  itemsBorradorMesa: many(itemsBorradorMesa),
  pedidos: many(pedidos),
  comandaItems: many(comandaItems),
  auditLog: many(auditLog),
  configuracionPagos: many(configuracionPagos),
  transaccionesPago: many(transaccionesPago),
}))

export const perfilesEmpleadosRelations = relations(perfilesEmpleados, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [perfilesEmpleados.restauranteId],
    references: [restaurantes.id],
  }),
}))

export const categoriasRelations = relations(categorias, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [categorias.restauranteId],
    references: [restaurantes.id],
  }),
  productos: many(productos),
}))

export const productosRelations = relations(productos, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [productos.restauranteId],
    references: [restaurantes.id],
  }),
  categoria: one(categorias, {
    fields: [productos.categoriaId],
    references: [categorias.id],
  }),
  precios: many(productosPrecios),
  modificadores: many(productoModificadoresDisponibles),
  comandaItems: many(comandaItems),
}))

export const productosPreciosRelations = relations(productosPrecios, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [productosPrecios.restauranteId],
    references: [restaurantes.id],
  }),
  producto: one(productos, {
    fields: [productosPrecios.productoId],
    references: [productos.id],
  }),
}))

export const modificadoresRelations = relations(modificadores, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [modificadores.restauranteId],
    references: [restaurantes.id],
  }),
  precios: many(modificadoresPrecios),
  productos: many(productoModificadoresDisponibles),
}))

export const modificadoresPreciosRelations = relations(modificadoresPrecios, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [modificadoresPrecios.restauranteId],
    references: [restaurantes.id],
  }),
  modificador: one(modificadores, {
    fields: [modificadoresPrecios.modificadorId],
    references: [modificadores.id],
  }),
}))

export const productoModificadoresDisponiblesRelations = relations(
  productoModificadoresDisponibles,
  ({ one }) => ({
    producto: one(productos, {
      fields: [productoModificadoresDisponibles.productoId],
      references: [productos.id],
    }),
    modificador: one(modificadores, {
      fields: [productoModificadoresDisponibles.modificadorId],
      references: [modificadores.id],
    }),
  })
)

export const mesasRelations = relations(mesas, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [mesas.restauranteId],
    references: [restaurantes.id],
  }),
  ambiente: one(ambientes, {
    fields: [mesas.ambienteId],
    references: [ambientes.id],
  }),
  sesiones: many(sesionesMesa),
}))

export const ambientesRelations = relations(ambientes, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [ambientes.restauranteId],
    references: [restaurantes.id],
  }),
  mesas: many(mesas),
  elementos: many(elementosPlano),
}))

export const elementosPlanoRelations = relations(elementosPlano, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [elementosPlano.restauranteId],
    references: [restaurantes.id],
  }),
  ambiente: one(ambientes, {
    fields: [elementosPlano.ambienteId],
    references: [ambientes.id],
  }),
}))

export const sesionesMesaRelations = relations(sesionesMesa, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [sesionesMesa.restauranteId],
    references: [restaurantes.id],
  }),
  mesa: one(mesas, {
    fields: [sesionesMesa.mesaId],
    references: [mesas.id],
  }),
  itemsBorrador: many(itemsBorradorMesa),
  pedidos: many(pedidos),
  transaccionesPago: many(transaccionesPago),
}))

export const itemsBorradorMesaRelations = relations(itemsBorradorMesa, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [itemsBorradorMesa.restauranteId],
    references: [restaurantes.id],
  }),
  sesionMesa: one(sesionesMesa, {
    fields: [itemsBorradorMesa.sesionMesaId],
    references: [sesionesMesa.id],
  }),
  producto: one(productos, {
    fields: [itemsBorradorMesa.productoId],
    references: [productos.id],
  }),
}))

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [pedidos.restauranteId],
    references: [restaurantes.id],
  }),
  sesionMesa: one(sesionesMesa, {
    fields: [pedidos.sesionMesaId],
    references: [sesionesMesa.id],
  }),
  items: many(comandaItems),
}))

export const comandaItemsRelations = relations(comandaItems, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [comandaItems.restauranteId],
    references: [restaurantes.id],
  }),
  pedido: one(pedidos, {
    fields: [comandaItems.pedidoId],
    references: [pedidos.id],
  }),
  producto: one(productos, {
    fields: [comandaItems.productoId],
    references: [productos.id],
  }),
  modificadores: many(comandaItemModificadores),
}))

export const comandaItemModificadoresRelations = relations(
  comandaItemModificadores,
  ({ one }) => ({
    restaurante: one(restaurantes, {
      fields: [comandaItemModificadores.restauranteId],
      references: [restaurantes.id],
    }),
    comandaItem: one(comandaItems, {
      fields: [comandaItemModificadores.comandaItemId],
      references: [comandaItems.id],
    }),
    modificador: one(modificadores, {
      fields: [comandaItemModificadores.modificadorId],
      references: [modificadores.id],
    }),
  })
)

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [auditLog.restauranteId],
    references: [restaurantes.id],
  }),
}))

export const configuracionPagosRelations = relations(configuracionPagos, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [configuracionPagos.restauranteId],
    references: [restaurantes.id],
  }),
}))

export const transaccionesPagoRelations = relations(transaccionesPago, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [transaccionesPago.restauranteId],
    references: [restaurantes.id],
  }),
  sesionMesa: one(sesionesMesa, {
    fields: [transaccionesPago.sesionMesaId],
    references: [sesionesMesa.id],
  }),
}))