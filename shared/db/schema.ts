import {
  boolean,
  check,
  foreignKey,
  index,
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
    /** Plan SaaS: basico | pro | a_medida */
    plan: text('plan').notNull().default('pro'),
    /**
     * trial = prueba gratis; active = al día; past_due = vencido;
     * cancelled = cancelado; exempt = piloto sin cobro (manual).
     */
    billingStatus: text('billing_status').notNull().default('trial'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    /** Fin del período pago (renovable con cada cobro SaaS). */
    periodEndsAt: timestamp('period_ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: uniqueIndex('restaurantes_slug_idx').on(table.slug),
    planCheck: check(
      'restaurantes_plan_check',
      sql`plan IN ('basico','pro','a_medida')`,
    ),
    billingStatusCheck: check(
      'restaurantes_billing_status_check',
      sql`billing_status IN ('trial','active','past_due','cancelled','exempt')`,
    ),
  })
)

/**
 * Cobros de la suscripción SaaS (acomer cobra al local).
 * Distinto de transacciones_pago (el local cobra al comensal).
 */
export const pagosSuscripcion = pgTable(
  'pagos_suscripcion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    plan: text('plan').notNull(),
    monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
    estado: text('estado').notNull().default('pending'), // pending | approved | rejected | cancelled
    mpPreferenceId: text('mp_preference_id'),
    mpPaymentId: text('mp_payment_id'),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'pagos_suscripcion_restaurant_id_fk',
    }).onDelete('cascade'),
    estadoCheck: check(
      'pagos_suscripcion_estado_check',
      sql`estado IN ('pending','approved','rejected','cancelled')`,
    ),
    planCheck: check(
      'pagos_suscripcion_plan_check',
      sql`plan IN ('basico','pro','a_medida')`,
    ),
    restauranteIdx: index('pagos_suscripcion_restaurant_idx').on(table.restauranteId),
  }),
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
    /** Clave de la paleta (p. ej. terracota, verde). Ver features/menu/categoriaVisual. */
    color: text('color').notNull().default('terracota'),
    /** Nombre de icono Lucide (p. ej. utensils, coffee). Ver features/menu/categoriaVisual. */
    icono: text('icono').notNull().default('utensils'),
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
// Variantes (presentaciones de un plato: elección única, precio fijo)
// ============================================================================

// Un producto es "de precio único" (productos_precios) O "con variantes". Si tiene
// al menos una variante activa, el precio vive acá (no en productos_precios) y la
// elección es única y requerida al pedir. P. ej. Milanesa → Simple / Napolitana /
// A caballo / Doble caballo.
export const productoVariantes = pgTable(
  'producto_variantes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    nombre: text('nombre').notNull(),
    orden: integer('orden').notNull().default(0),
    esDefault: boolean('es_default').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'producto_variantes_restaurant_id_fk',
    }).onDelete('cascade'),
    productoIdFk: foreignKey({
      columns: [table.productoId],
      foreignColumns: [productos.id],
      name: 'producto_variantes_producto_id_fk',
    }).onDelete('cascade'),
  })
)

// Precio absoluto de cada variante (ledger append-only, igual que productos_precios).
export const productoVariantesPrecios = pgTable(
  'producto_variantes_precios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    varianteId: uuid('variante_id').notNull(),
    precio: numeric('precio', { precision: 10, scale: 2 }).notNull(),
    vigenteSde: timestamp('vigente_desde', { withTimezone: true }).defaultNow(),
    vigentaHsta: timestamp('vigente_hasta', { withTimezone: true }),
    creadoPor: uuid('creado_por'),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'producto_variantes_precios_restaurant_id_fk',
    }).onDelete('cascade'),
    varianteIdFk: foreignKey({
      columns: [table.varianteId],
      foreignColumns: [productoVariantes.id],
      name: 'producto_variantes_precios_variante_id_fk',
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
    rotacion: integer('rotacion').notNull().default(0), // grados 0–359 (libre en el editor)
    // Cuando la mesa es una sub-mesa temporal (división), apunta a la mesa madre
    parentMesaId: uuid('parent_mesa_id').references((): AnyPgColumn => mesas.id, { onDelete: 'cascade' }),
    /** Mozo responsable (auth.users). Null = sin asignar. */
    mozoUserId: uuid('mozo_user_id'),
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
    mozoUserIdIdx: index('mesas_mozo_user_id_idx').on(table.restauranteId, table.mozoUserId),
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
    mesaId: uuid('mesa_id'), // nullable: takeaway/delivery no tienen mesa física
    tipo: text('tipo').notNull().default('salon'), // salon | takeaway | delivery | mostrador
    estado: text('estado').notNull().default('Activa'), // Activa | Cerrada
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteCreatedAtIdx: index('sesiones_mesa_restaurante_created_at_idx').on(table.restauranteId, table.createdAt),
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
    tipoCheck: check('sesiones_mesa_tipo_check', sql`tipo IN ('salon','takeaway','delivery','mostrador')`),
  })
)

// ============================================================================
// Entrega (takeaway / delivery) y Reservas
// ============================================================================

// 1:1 con la sesión cuando es takeaway/delivery. Guarda el contacto en la orden
// (sin CRM por ahora; el teléfono queda acá).
export const datosEntrega = pgTable(
  'datos_entrega',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    sesionMesaId: uuid('sesion_mesa_id').notNull().unique(),
    nombreContacto: text('nombre_contacto').notNull(),
    telefono: text('telefono').notNull(),
    direccion: text('direccion'),
    referencia: text('referencia'),
    // Pin del cliente en el mapa (si el local tiene zona dibujada).
    lat: real('lat'),
    lng: real('lng'),
    costoEnvio: numeric('costo_envio', { precision: 10, scale: 2 }).notNull().default('0'),
    estadoEntrega: text('estado_entrega').notNull().default('Recibido'),
    horaEstimada: timestamp('hora_estimada', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'datos_entrega_restaurant_id_fk',
    }).onDelete('cascade'),
    sesionMesaIdFk: foreignKey({
      columns: [table.sesionMesaId],
      foreignColumns: [sesionesMesa.id],
      name: 'datos_entrega_sesion_mesa_id_fk',
    }).onDelete('cascade'),
    estadoCheck: check(
      'datos_entrega_estado_check',
      sql`estado_entrega IN ('Recibido','EnPreparacion','Listo','EnCamino','Entregado','Cancelado')`
    ),
  })
)

export const reservas = pgTable(
  'reservas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    nombreContacto: text('nombre_contacto').notNull(),
    telefono: text('telefono').notNull(),
    mesaId: uuid('mesa_id'),
    ambienteId: uuid('ambiente_id'),
    inicio: timestamp('inicio', { withTimezone: true }).notNull(),
    duracionMin: integer('duracion_min').notNull().default(90),
    cantidadPersonas: integer('cantidad_personas').notNull(),
    estado: text('estado').notNull().default('Pendiente'), // Pendiente | Confirmada | Sentada | NoShow | Cancelada | Cumplida
    origen: text('origen').notNull().default('online'), // online | telefono | walkin
    sesionMesaId: uuid('sesion_mesa_id'),
    notas: text('notas'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'reservas_restaurant_id_fk',
    }).onDelete('cascade'),
    mesaIdFk: foreignKey({
      columns: [table.mesaId],
      foreignColumns: [mesas.id],
      name: 'reservas_mesa_id_fk',
    }).onDelete('set null'),
    ambienteIdFk: foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambientes.id],
      name: 'reservas_ambiente_id_fk',
    }).onDelete('set null'),
    sesionMesaIdFk: foreignKey({
      columns: [table.sesionMesaId],
      foreignColumns: [sesionesMesa.id],
      name: 'reservas_sesion_mesa_id_fk',
    }).onDelete('set null'),
    estadoCheck: check(
      'reservas_estado_check',
      sql`estado IN ('Pendiente','Confirmada','Sentada','NoShow','Cancelada','Cumplida')`
    ),
    origenCheck: check('reservas_origen_check', sql`origen IN ('online','telefono','walkin')`),
  })
)

// Configuración de reservas por restaurante (1:1). Define los turnos/horarios
// habilitados, la duración por defecto y los cupos. Los cupos en null = sin
// límite. Si no existe fila, se usan los defaults de la app.
export const reservasConfig = pgTable(
  'reservas_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull().unique(),
    activo: boolean('activo').notNull().default(false), // reservas online: off hasta activar
    // array de turnos con nombre y rango: { nombre, desde, hasta, activo }
    turnos: jsonb('turnos').notNull().default([
      { nombre: 'Almuerzo', desde: '12:00', hasta: '15:30', activo: true },
      { nombre: 'Cena', desde: '20:00', hasta: '00:00', activo: true },
    ]),
    duracionMinDefault: integer('duracion_min_default').notNull().default(90),
    anticipacionMinMin: integer('anticipacion_min_min').notNull().default(120), // min de anticipación; 0 = sin mínimo
    cupoCubiertosPorTurno: integer('cupo_cubiertos_por_turno'), // null = sin límite
    maxReservasPorDia: integer('max_reservas_por_dia'), // null = sin límite
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'reservas_config_restaurant_id_fk',
    }).onDelete('cascade'),
  })
)

// Configuración de pedidos online (takeaway/delivery) 1:1 con el restaurante:
// qué modalidades ofrece y hasta cuándo el cliente puede sumar productos a un
// pedido ya confirmado. Si no hay fila, la app usa sus defaults.
export const deliveryConfig = pgTable(
  'delivery_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull().unique(),
    activo: boolean('activo').notNull().default(false), // pedidos online: off hasta activar
    modo: text('modo').notNull().default('ambos'), // ambos | takeaway | delivery
    agregadosHasta: text('agregados_hasta').notNull().default('preparacion'), // no | preparacion | listo
    // Zona de cobertura en texto libre (barrios, radio, etc.). Complementa el mapa.
    zonaEntrega: text('zona_entrega').notNull().default(''),
    // Polígono GeoJSON de cobertura: { type:'Polygon', coordinates:[[[lng,lat],…]] }.
    zonaPoligono: jsonb('zona_poligono'),
    // Costo fijo de envío en pesos (0 = gratis / a confirmar en local).
    costoEnvio: numeric('costo_envio', { precision: 10, scale: 2 }).notNull().default('0'),
    // Mínimo del carrito (sin envío) para aceptar delivery. 0 = sin mínimo.
    pedidoMinimo: numeric('pedido_minimo', { precision: 10, scale: 2 }).notNull().default('0'),
    // Tiempo estimado de entrega/preparación en minutos. null = no mostrar.
    tiempoEstimadoMin: integer('tiempo_estimado_min'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'delivery_config_restaurant_id_fk',
    }).onDelete('cascade'),
    modoCheck: check('delivery_config_modo_check', sql`modo IN ('ambos','takeaway','delivery')`),
    agregadosCheck: check(
      'delivery_config_agregados_check',
      sql`agregados_hasta IN ('no','preparacion','listo')`,
    ),
  })
)

// Configuración de la landing pública del local (home del tenant): descripción,
// dirección, horarios de atención por día, qué acciones se ofrecen, color de
// marca y redes. 1:1 con el restaurante; si no hay fila, la app usa sus defaults
// (ver features/landing/landingConfig.ts).
export const landingConfig = pgTable(
  'landing_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull().unique(),
    descripcion: text('descripcion').notNull().default(''), // tagline ("Cocina de barrio · Parrilla")
    // Texto más largo tipo "sobre el local" (historia, especialidades, etc.).
    sobre: text('sobre').notNull().default(''),
    direccion: text('direccion').notNull().default(''),
    // 7 días indexados por getDay() (0=Dom … 6=Sáb): { cerrado, desde, hasta }.
    horarios: jsonb('horarios').notNull().default([
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
      { cerrado: false, desde: '12:00', hasta: '00:00' },
    ]),
    // Qué tarjetas se muestran: { verCarta, pedirOnline, reservar, qr }.
    acciones: jsonb('acciones')
      .notNull()
      .default({ verCarta: true, pedirOnline: false, reservar: false, qr: true }),
    // terracota | ambar | verde | azul | bordo | negro | rosa | indigo
    colorMarca: text('color_marca').notNull().default('terracota'),
    // Contacto/redes: { whatsapp, instagram, telefono }.
    redes: jsonb('redes').notNull().default({ whatsapp: '', instagram: '', telefono: '' }),
    // Portada del local en Cloudinary. URL de entrega ya optimizada (f_auto,q_auto).
    imagenUrl: text('imagen_url').notNull().default(''),
    // public_id en Cloudinary para borrar/reemplazar sin dejar huérfanos.
    imagenPublicId: text('imagen_public_id').notNull().default(''),
    // Logo circular / cuadrado del local (Cloudinary).
    logoUrl: text('logo_url').notNull().default(''),
    logoPublicId: text('logo_public_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'landing_config_restaurant_id_fk',
    }).onDelete('cascade'),
    colorMarcaCheck: check(
      'landing_config_color_marca_check',
      sql`color_marca IN ('terracota','ambar','verde','azul','bordo','negro','rosa','indigo')`,
    ),
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
    // Variante elegida (presentación del plato). Null si el producto no tiene variantes.
    varianteId: uuid('variante_id'),
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
    varianteIdFk: foreignKey({
      columns: [table.varianteId],
      foreignColumns: [productoVariantes.id],
      name: 'items_borrador_mesa_variante_id_fk',
    }).onDelete('set null'),
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
    restauranteCreatedAtIdx: index('pedidos_restaurante_created_at_idx').on(table.restauranteId, table.createdAt),
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
    // Nullable: un "ítem libre" (algo que no está en la carta) no referencia un
    // producto. El nombre y el precio quedan en los snapshots de abajo.
    productoId: uuid('producto_id'),
    // Variante elegida (presentación). Su nombre/precio ya van en los snapshots;
    // se guarda el id para reportes por variante. Null si el producto no tiene variantes.
    varianteId: uuid('variante_id'),
    cantidad: numeric('cantidad', { precision: 5, scale: 0 }).notNull().default('1'),
    nombreProductoSnapshot: text('nombre_producto_snapshot').notNull(),
    precioUnitarioSnapshot: numeric('precio_unitario_snapshot', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteCreatedAtIdx: index('comanda_items_restaurante_created_at_idx').on(table.restauranteId, table.createdAt),
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
    varianteIdFk: foreignKey({
      columns: [table.varianteId],
      foreignColumns: [productoVariantes.id],
      name: 'comanda_items_variante_id_fk',
    }).onDelete('set null'),
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
// Promociones (descuentos y combos)
// ============================================================================

// Una promoción del restaurante. Ver drizzle/0011_promociones.sql para el
// detalle de cada campo (tipo, alcance, target_ids, condiciones).
export const promociones = pgTable(
  'promociones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    nombre: text('nombre').notNull(),
    tipo: text('tipo').notNull(), // porcentaje | monto_fijo | 2x1 | combo
    valor: numeric('valor', { precision: 10, scale: 2 }).notNull().default('0'),
    alcance: text('alcance').notNull().default('pedido'), // pedido | categoria | producto
    targetIds: jsonb('target_ids').notNull().default([]),
    condiciones: jsonb('condiciones').notNull().default({}),
    vigenteDesde: timestamp('vigente_desde', { withTimezone: true }),
    vigenteHasta: timestamp('vigente_hasta', { withTimezone: true }),
    activa: boolean('activa').notNull().default(true),
    prioridad: integer('prioridad').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'promociones_restaurant_id_fk',
    }).onDelete('cascade'),
    tipoCheck: check(
      'promociones_tipo_check',
      sql`tipo IN ('porcentaje','monto_fijo','2x1','combo')`,
    ),
    alcanceCheck: check(
      'promociones_alcance_check',
      sql`alcance IN ('pedido','categoria','producto')`,
    ),
  }),
)

// ============================================================================
// Caja (apertura, movimientos y arqueo de turno)
// Va antes de Pagos porque transacciones_pago referencia sesiones_caja.
// ============================================================================

export const sesionesCaja = pgTable(
  'sesiones_caja',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    abiertaPor: uuid('abierta_por').notNull(), // auth.users
    cerradaPor: uuid('cerrada_por'),
    estado: text('estado').notNull().default('Abierta'), // Abierta | Cerrada
    montoInicial: numeric('monto_inicial', { precision: 10, scale: 2 }).notNull().default('0'),
    montoFinalContado: numeric('monto_final_contado', { precision: 10, scale: 2 }),
    montoEsperado: numeric('monto_esperado', { precision: 10, scale: 2 }),
    diferencia: numeric('diferencia', { precision: 10, scale: 2 }),
    notasCierre: text('notas_cierre'),
    abiertaAt: timestamp('abierta_at', { withTimezone: true }).notNull().defaultNow(),
    cerradaAt: timestamp('cerrada_at', { withTimezone: true }),
  },
  (table) => ({
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'sesiones_caja_restaurant_id_fk',
    }).onDelete('cascade'),
    estadoCheck: check('sesiones_caja_estado_check', sql`estado IN ('Abierta','Cerrada')`),
  })
)

export const movimientosCaja = pgTable(
  'movimientos_caja',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    sesionCajaId: uuid('sesion_caja_id').notNull(),
    tipo: text('tipo').notNull(), // ingreso | egreso | retiro
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
    concepto: text('concepto'),
    registradoPor: uuid('registrado_por'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteCreatedAtIdx: index('movimientos_caja_restaurante_created_at_idx').on(table.restauranteId, table.createdAt),
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'movimientos_caja_restaurant_id_fk',
    }).onDelete('cascade'),
    sesionCajaIdFk: foreignKey({
      columns: [table.sesionCajaId],
      foreignColumns: [sesionesCaja.id],
      name: 'movimientos_caja_sesion_caja_id_fk',
    }).onDelete('cascade'),
    tipoCheck: check('movimientos_caja_tipo_check', sql`tipo IN ('ingreso','egreso','retiro')`),
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
    /** Turno de caja en el que se cobró (null si no había caja abierta o dato histórico). */
    sesionCajaId: uuid('sesion_caja_id'),
    proveedor: text('proveedor').notNull(),
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(), // total YA con descuento
    descuento: numeric('descuento', { precision: 10, scale: 2 }).notNull().default('0'),
    promocionId: uuid('promocion_id'), // promo aplicada (null si manual, borrada o si aplicaron 2+)
    // Snapshot de TODAS las promos aplicadas en el cobro: sobrevive aunque después
    // se edite/borre la promo y soporta varias a la vez (promocion_id sólo guarda una).
    promocionesAplicadas: jsonb('promociones_aplicadas')
      .$type<{ id: string; nombre: string; tipo: string; descuento: number }[]>()
      .notNull()
      .default([]),
    estado: text('estado').notNull().default('Pendiente'), // Pendiente | Aprobado | Rechazado | Cancelado
    referenciaExterna: text('referencia_externa'), // ID del pago/preferencia en MP
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteCreatedAtIdx: index('transacciones_pago_restaurante_created_at_idx').on(table.restauranteId, table.createdAt),
    sesionCajaIdIdx: index('transacciones_pago_sesion_caja_id_idx').on(table.sesionCajaId),
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
    sesionCajaIdFk: foreignKey({
      columns: [table.sesionCajaId],
      foreignColumns: [sesionesCaja.id],
      name: 'transacciones_pago_sesion_caja_id_fk',
    }).onDelete('set null'),
    promocionIdFk: foreignKey({
      columns: [table.promocionId],
      foreignColumns: [promociones.id],
      name: 'transacciones_pago_promocion_id_fk',
    }).onDelete('set null'),
  })
)

// ============================================================================
// Alertas del staff (campana del admin)
// ============================================================================
// Persistimos avisos operativos (llamar mozo, etc.) para que no dependan solo
// de Realtime efímero: si el mozo no estaba conectado, los ve al recargar.

export const staffAlerts = pgTable(
  'staff_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restauranteId: uuid('restaurant_id').notNull(),
    tipo: text('tipo').notNull(), // llamar_mozo | ...
    titulo: text('titulo').notNull(),
    cuerpo: text('cuerpo').notNull(),
    href: text('href'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restauranteCreatedAtIdx: index('staff_alerts_restaurante_created_at_idx').on(
      table.restauranteId,
      table.createdAt,
    ),
    restauranteIdFk: foreignKey({
      columns: [table.restauranteId],
      foreignColumns: [restaurantes.id],
      name: 'staff_alerts_restaurant_id_fk',
    }).onDelete('cascade'),
  }),
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
  staffAlerts: many(staffAlerts),
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
  sesionesCaja: many(sesionesCaja),
  movimientosCaja: many(movimientosCaja),
  datosEntrega: many(datosEntrega),
  reservas: many(reservas),
  pagosSuscripcion: many(pagosSuscripcion),
}))

export const pagosSuscripcionRelations = relations(pagosSuscripcion, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [pagosSuscripcion.restauranteId],
    references: [restaurantes.id],
  }),
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
  variantes: many(productoVariantes),
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

export const productoVariantesRelations = relations(productoVariantes, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [productoVariantes.restauranteId],
    references: [restaurantes.id],
  }),
  producto: one(productos, {
    fields: [productoVariantes.productoId],
    references: [productos.id],
  }),
  precios: many(productoVariantesPrecios),
}))

export const productoVariantesPreciosRelations = relations(productoVariantesPrecios, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [productoVariantesPrecios.restauranteId],
    references: [restaurantes.id],
  }),
  variante: one(productoVariantes, {
    fields: [productoVariantesPrecios.varianteId],
    references: [productoVariantes.id],
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
  variante: one(productoVariantes, {
    fields: [itemsBorradorMesa.varianteId],
    references: [productoVariantes.id],
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
  variante: one(productoVariantes, {
    fields: [comandaItems.varianteId],
    references: [productoVariantes.id],
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

export const landingConfigRelations = relations(landingConfig, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [landingConfig.restauranteId],
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
  sesionCaja: one(sesionesCaja, {
    fields: [transaccionesPago.sesionCajaId],
    references: [sesionesCaja.id],
  }),
}))

export const sesionesCajaRelations = relations(sesionesCaja, ({ one, many }) => ({
  restaurante: one(restaurantes, {
    fields: [sesionesCaja.restauranteId],
    references: [restaurantes.id],
  }),
  movimientos: many(movimientosCaja),
  transacciones: many(transaccionesPago),
}))

export const movimientosCajaRelations = relations(movimientosCaja, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [movimientosCaja.restauranteId],
    references: [restaurantes.id],
  }),
  sesionCaja: one(sesionesCaja, {
    fields: [movimientosCaja.sesionCajaId],
    references: [sesionesCaja.id],
  }),
}))

export const datosEntregaRelations = relations(datosEntrega, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [datosEntrega.restauranteId],
    references: [restaurantes.id],
  }),
  sesionMesa: one(sesionesMesa, {
    fields: [datosEntrega.sesionMesaId],
    references: [sesionesMesa.id],
  }),
}))

export const reservasRelations = relations(reservas, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [reservas.restauranteId],
    references: [restaurantes.id],
  }),
  mesa: one(mesas, {
    fields: [reservas.mesaId],
    references: [mesas.id],
  }),
  ambiente: one(ambientes, {
    fields: [reservas.ambienteId],
    references: [ambientes.id],
  }),
  sesionMesa: one(sesionesMesa, {
    fields: [reservas.sesionMesaId],
    references: [sesionesMesa.id],
  }),
}))