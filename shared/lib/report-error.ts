/**
 * Reporte de errores centralizado.
 *
 * Enganche único para Sentry:
 * - Si está `SENTRY_DSN` y se instaló `@sentry/nextjs`, el SDK puede inyectar
 *   `globalThis.Sentry` o se usa fetch al envelope (fallback mínimo).
 * - Tags multi-tenant: pasá `restauranteId` / `slug` en `context`.
 */

type ReportContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ReportContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (context) {
    console.error(`[${context.scope ?? 'app'}]`, err, context);
  } else {
    console.error(err);
  }

  try {
    const g = globalThis as typeof globalThis & {
      Sentry?: {
        captureException: (
          e: Error,
          ctx?: { extra?: ReportContext; tags?: Record<string, string> },
        ) => void;
      };
    };
    if (g.Sentry?.captureException) {
      const tags: Record<string, string> = {};
      if (context?.restauranteId != null) tags.restauranteId = String(context.restauranteId);
      if (context?.slug != null) tags.slug = String(context.slug);
      if (context?.scope != null) tags.scope = String(context.scope);
      g.Sentry.captureException(err, {
        extra: context,
        tags: Object.keys(tags).length ? tags : undefined,
      });
    }
  } catch {
    // ignore
  }
}
