/**
 * Fábrica central de query keys para TanStack Query.
 * Usar siempre estas funciones en `useQuery`, `useMutation` (onSuccess) e
 * `invalidateQueries` para mantener las keys consistentes en toda la app.
 */
export const queryKeys = {
  cobros: (tenantId: string) => ['cobros', tenantId] as const,
  empleados: () => ['empleados'] as const,
  plano: (restauranteId: string) => ['plano', restauranteId] as const,
};
