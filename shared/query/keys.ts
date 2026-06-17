/**
 * Fábrica central de query keys para TanStack Query.
 * Usar siempre estas funciones en `useQuery`, `useMutation` (onSuccess) e
 * `invalidateQueries` para mantener las keys consistentes en toda la app.
 */
export const queryKeys = {
  cobros: (tenantId: string) => ['cobros', tenantId] as const,
  empleados: () => ['empleados'] as const,
  plano: (restauranteId: string) => ['plano', restauranteId] as const,
  borrador: (sesionMesaId: string) => ['borrador', sesionMesaId] as const,
  dashboard: (tenantId: string) => ['dashboard', tenantId] as const,
  reportes: (tenantId: string, desde: string, hasta: string) =>
    ['reportes', tenantId, desde, hasta] as const,
  caja: (tenantId: string) => ['caja', tenantId] as const,
  cajaHistorial: (tenantId: string) => ['caja', 'historial', tenantId] as const,
  variantesMenu: () => ['variantes-menu'] as const,
  categoriasMenu: () => ['categorias-menu'] as const,
  productosMenu: () => ['productos-menu'] as const,
  ticketMesa: (sesionMesaId: string) => ['ticket-mesa', sesionMesaId] as const,
  ordenesExternas: (tenantId: string) => ['ordenes-externas', tenantId] as const,
  reservasDia: (tenantId: string, fecha: string) => ['reservas', tenantId, fecha] as const,
  reservasMes: (tenantId: string, mes: string) => ['reservas', 'mes', tenantId, mes] as const,
  disponibilidad: (inicioISO: string, personas: number) =>
    ['disponibilidad', inicioISO, personas] as const,
};
