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
};
