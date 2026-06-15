import { QueryClient, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Evita un refetch inmediato tras hidratar con initialData del Server Component.
        staleTime: 30 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Patrón oficial de TanStack Query para el App Router:
 * - En el servidor se crea un QueryClient nuevo por request.
 * - En el browser se reutiliza un singleton para no perder la caché entre renders.
 */
export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
