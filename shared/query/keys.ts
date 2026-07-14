/**
 * Fábrica central de query keys para TanStack Query.
 * Usar siempre estas funciones en `useQuery`, `useMutation` (onSuccess) e
 * `invalidateQueries` para mantener las keys consistentes en toda la app.
 */
export const queryKeys = {
  cobros: (tenantId: string) => ['cobros', tenantId] as const,
  empleados: () => ['empleados'] as const,
  plano: (restauranteId: string) => ['plano', restauranteId] as const,
  mozos: (tenantId: string) => ['mozos', tenantId] as const,
  staffAlerts: (tenantId: string) => ['staff-alerts', tenantId] as const,
  adminSearch: (query: string) => ['admin-search', query] as const,
  borrador: (sesionMesaId: string) => ['borrador', sesionMesaId] as const,
  dashboard: (tenantId: string) => ['dashboard', tenantId] as const,
  reportes: (tenantId: string, desde: string, hasta: string) =>
    ['reportes', tenantId, desde, hasta] as const,
  caja: (tenantId: string) => ['caja', tenantId] as const,
  cajaHistorial: (tenantId: string) => ['caja', 'historial', tenantId] as const,
  cajaDetalle: (sesionCajaId: string) => ['caja', 'detalle', sesionCajaId] as const,
  // Adicionales: extras aditivos y opcionales de un plato (ex-"variantes").
  adicionalesMenu: () => ['adicionales-menu'] as const,
  // Variantes: presentaciones de elección única y precio fijo de un plato.
  variantesMenu: () => ['variantes-menu'] as const,
  categoriasMenu: () => ['categorias-menu'] as const,
  productosMenu: () => ['productos-menu'] as const,
  ticketMesa: (sesionMesaId: string) => ['ticket-mesa', sesionMesaId] as const,
  menuVenta: (tenantId: string) => ['menu-venta', tenantId] as const,
  metodosVenta: (tenantId: string) => ['metodos-venta', tenantId] as const,
  ventaPreview: (metodo: string, omitirIds: string[], items: unknown) =>
    ['venta-preview', metodo, omitirIds, items] as const,
  // Preview de la cuenta ya persistida por método de pago (modal del comensal).
  cuentaPreview: (sesionMesaId: string, metodo: string) =>
    ['cuenta-preview', sesionMesaId, metodo] as const,
  ordenesExternas: (tenantId: string) => ['ordenes-externas', tenantId] as const,
  reservasDia: (tenantId: string, fecha: string) => ['reservas', tenantId, fecha] as const,
  reservasMes: (tenantId: string, mes: string) => ['reservas', 'mes', tenantId, mes] as const,
  proximaReserva: (tenantId: string, desdeISO: string) =>
    ['reservas', 'proxima', tenantId, desdeISO] as const,
  reservaAnterior: (tenantId: string, hastaISO: string) =>
    ['reservas', 'anterior', tenantId, hastaISO] as const,
  disponibilidad: (inicioISO: string, personas: number) =>
    ['disponibilidad', inicioISO, personas] as const,
  mesasDisponibles: (inicioISO: string, personas: number, duracionMin: number) =>
    ['mesas-disponibles', inicioISO, personas, duracionMin] as const,
};
