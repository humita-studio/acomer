/**
 * Reloj de pared del local.
 *
 * El servidor corre en UTC (Vercel) y el comensal puede estar en cualquier
 * zona: `getHours()` / `setHours()` dan horas distintas según dónde corra el
 * código. Todo lo que hable de "las 21:00" o "el día de hoy" del local tiene
 * que pasar por acá. Hoy la zona es única (Argentina); cuando haya locales en
 * otro país, pasa a ser un dato del restaurante.
 */
export const ZONA_HORARIA_LOCAL = 'America/Argentina/Buenos_Aires';

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type PartesZona = {
  /** 'YYYY-MM-DD' en la zona del local. */
  ymd: string;
  /** 'HH:MM' (00–23) en la zona del local. */
  hhmm: string;
  /** Día de la semana en la zona del local (0 = domingo). */
  dow: number;
};

function partes(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday'),
  };
}

/** Partes de reloj de pared de un instante, en la zona del local. */
export function partesEnZona(date: Date, tz: string = ZONA_HORARIA_LOCAL): PartesZona {
  const p = partes(date, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    ymd: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    hhmm: `${pad(p.hour)}:${pad(p.minute)}`,
    dow: DOW[p.weekday] ?? date.getUTCDay(),
  };
}

/** Diferencia (ms) entre el reloj de pared de `tz` y UTC en ese instante. */
function offsetMs(date: Date, tz: string): number {
  const p = partes(date, tz);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Instante (UTC) que corresponde a un 'YYYY-MM-DD' + 'HH:MM' de reloj de pared
 * en la zona del local. Ej: '2026-09-04' 21:00 en Buenos Aires →
 * 2026-09-05T00:00:00.000Z.
 */
export function instanteEnZona(ymd: string, hhmm: string, tz: string = ZONA_HORARIA_LOCAL): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mi);
  let instante = wall - offsetMs(new Date(wall), tz);
  // Segunda pasada por si el offset cambia justo ahí (cambio de horario).
  const ajuste = offsetMs(new Date(instante), tz);
  if (wall - ajuste !== instante) instante = wall - ajuste;
  return new Date(instante);
}

/** Inicio del día (00:00 del local) del instante dado, como instante UTC. */
export function inicioDelDiaEnZona(date: Date, tz: string = ZONA_HORARIA_LOCAL): Date {
  return instanteEnZona(partesEnZona(date, tz).ymd, '00:00', tz);
}
