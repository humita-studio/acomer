/**
 * Reporte de errores centralizado.
 *
 * Si más adelante se configura Sentry (`SENTRY_DSN` / `@sentry/nextjs`),
 * este helper es el único punto de enganche. Hoy loguea a consola y, si existe
 * `window.Sentry` o un global inyectado, reenvía el error.
 */

type ReportContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ReportContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (context) {
    console.error(`[${context.scope ?? 'app'}]`, err, context);
  } else {
    console.error(err);
  }

  // Hook opcional: si el SDK de Sentry se inyecta en runtime.
  try {
    const g = globalThis as typeof globalThis & {
      Sentry?: { captureException: (e: Error, ctx?: { extra?: ReportContext }) => void };
    };
    g.Sentry?.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}
