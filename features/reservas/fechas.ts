// Helpers de fecha/hora compartidos por la agenda y el calendario de reservas.
// Todo lo que sale de un instante (ISO) se calcula en la zona del local, no en la
// del proceso: en Vercel el servidor corre en UTC y desfasaba las horas al hidratar.

import { partesEnZona } from '@/shared/lib/zonaHoraria';

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Date construida con componentes locales (calendario) → 'YYYY-MM-DD'. */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Día ('YYYY-MM-DD') de una reserva en la zona del local. */
export function ymdDeReserva(inicio: string | Date): string {
  return partesEnZona(new Date(inicio)).ymd;
}

/** 'HH:MM' de una reserva en la zona del local (reloj de 24 h). */
export function horaDe(inicio: string | Date): string {
  return partesEnZona(new Date(inicio)).hhmm;
}

/** Alias de `horaDe` (para ubicar una reserva en su turno). */
export function hhmm(inicio: string | Date): string {
  return horaDe(inicio);
}

/** 'YYYY-MM-DD' de hoy en la zona del local. */
export function hoyYMD(): string {
  return partesEnZona(new Date()).ymd;
}

/** 'YYYY-MM-DD' → "18 de junio". */
export function diaLegible(ymd: string): string {
  const [, mm, dd] = ymd.split('-').map(Number);
  return `${dd} de ${MESES[(mm ?? 1) - 1]}`;
}

/** 'YYYY-MM-DD' → "Jueves 18 de junio" (capitalizado). */
export function diaLegibleLargo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const txt = `${DIAS_LARGOS[dow]} ${d} de ${MESES[m - 1]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
