/**
 * Helpers de formato centralizados para las pantallas de gestión.
 * Moneda en pesos argentinos y fechas/horas en es-AR.
 */

const TZ = 'America/Argentina/Buenos_Aires';

const pesoFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Formatea un monto como pesos argentinos. Acepta number o string numérico. */
export function formatPeso(monto: number | string | null | undefined): string {
  const n = typeof monto === 'string' ? Number(monto) : monto ?? 0;
  return pesoFormatter.format(Number.isFinite(n) ? (n as number) : 0);
}

/** Formatea una fecha (corta) en es-AR, ej: "15/06/2026". */
export function formatFecha(fecha: Date | string | number): string {
  return new Date(fecha).toLocaleDateString('es-AR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Formatea una hora (HH:mm) en es-AR. */
export function formatHora(fecha: Date | string | number): string {
  return new Date(fecha).toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatea fecha + hora, ej: "15/06/2026 14:30". */
export function formatFechaHora(fecha: Date | string | number): string {
  return `${formatFecha(fecha)} ${formatHora(fecha)}`;
}
