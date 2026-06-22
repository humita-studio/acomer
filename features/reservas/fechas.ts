// Helpers de fecha/hora compartidos por la agenda y el calendario de reservas.

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Date → 'YYYY-MM-DD' en hora local. */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ymdDeReserva(inicio: string | Date): string {
  return toYMD(new Date(inicio));
}

/** 'HH:MM' local de una reserva. */
export function horaDe(inicio: string | Date): string {
  return new Date(inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/** 'HH:MM' en reloj de pared local (para ubicar una reserva en su turno). */
export function hhmm(inicio: string | Date): string {
  const d = new Date(inicio);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → "18 de junio". */
export function diaLegible(ymd: string): string {
  const [, mm, dd] = ymd.split('-').map(Number);
  return `${dd} de ${MESES[(mm ?? 1) - 1]}`;
}

/** 'YYYY-MM-DD' → "Jueves 18 de junio" (capitalizado). */
export function diaLegibleLargo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const txt = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
