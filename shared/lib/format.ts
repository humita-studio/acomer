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

/** Miles con punto (es-AR): "1234567" → "1.234.567". */
function formatMiles(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Preprocesa pegado / valores con formato mixto a una forma tipeable
 * (solo dígitos + una coma decimal opcional).
 */
function preprocessMoneyRaw(raw: string): string {
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return '';

  if (s.includes(',') && s.includes('.')) {
    // "1.500,50" vs "1,500.50"
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      return s.replace(/\./g, '');
    }
    return s.replace(/,/g, '').replace('.', ',');
  }

  const dots = (s.match(/\./g) || []).length;
  if (dots > 1) {
    // "1.234.567" → miles
    return s.replace(/\./g, '');
  }

  const commas = (s.match(/,/g) || []).length;
  if (commas > 1) {
    return s.replace(/,/g, '');
  }

  // Un solo punto: "1.500" (miles) vs "1.5" / "1.50" (decimal)
  const m = s.match(/^(\d+)\.(\d+)$/);
  if (m) {
    if (m[2].length === 3) return m[1] + m[2];
    return `${m[1]},${m[2]}`;
  }

  return s;
}

export type MoneyTypingResult = {
  /** Texto a mostrar en el input (ej. "1.500,50"). */
  display: string;
  /** Valor canónico con punto decimal JS (ej. "1500.5"), o "" si vacío. */
  value: string;
};

/**
 * Formatea lo que el usuario escribe en un input de dinero (es-AR).
 * - Miles con punto, decimales con coma.
 * - `value` queda listo para Number() / parseFloat().
 */
export function formatMoneyTyping(
  raw: string,
  options?: { allowDecimals?: boolean; maxDecimals?: number },
): MoneyTypingResult {
  const allowDecimals = options?.allowDecimals ?? true;
  const maxDecimals = options?.maxDecimals ?? 2;

  const cleaned = preprocessMoneyRaw(raw);
  if (!cleaned) return { display: '', value: '' };

  if (!allowDecimals) {
    const intDigits = cleaned.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    return { display: formatMiles(intDigits), value: intDigits };
  }

  let intDigits = '';
  let fracDigits = '';
  let hasSep = false;

  for (const c of cleaned) {
    if (c === ',' || c === '.') {
      if (!hasSep) hasSep = true;
      continue;
    }
    if (c < '0' || c > '9') continue;
    if (hasSep) {
      if (fracDigits.length < maxDecimals) fracDigits += c;
    } else {
      intDigits += c;
    }
  }

  intDigits = intDigits.replace(/^0+(?=\d)/, '');

  if (!intDigits && !hasSep) return { display: '', value: '' };

  const displayInt = intDigits === '' ? (hasSep ? '0' : '') : formatMiles(intDigits);
  const display = hasSep ? `${displayInt || '0'},${fracDigits}` : displayInt;

  let value: string;
  if (hasSep && fracDigits.length > 0) {
    value = `${intDigits || '0'}.${fracDigits}`;
  } else {
    value = intDigits || (hasSep ? '0' : '');
  }

  return { display, value };
}

/**
 * Formatea un valor numérico canónico para mostrarlo en el input (fuera de foco).
 * Ej: 1500.5 → "1.500,5"
 */
export function formatMoneyFromValue(
  value: string | number | null | undefined,
  options?: { allowDecimals?: boolean; maxDecimals?: number },
): string {
  if (value == null || value === '') return '';
  const allowDecimals = options?.allowDecimals ?? true;
  const maxDecimals = options?.maxDecimals ?? 2;
  const n =
    typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: allowDecimals ? maxDecimals : 0,
  }).format(n);
}

/**
 * Parsea un monto tipeado (con o sin formato) a number.
 * Devuelve null si está vacío o no es numérico.
 */
export function parseMontoInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const { value } = formatMoneyTyping(String(raw));
  if (value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

/** Formatea una fecha corta con mes abreviado, ej: "17 jun". */
export function formatFechaCorta(fecha: Date | string | number): string {
  return new Date(fecha)
    .toLocaleDateString('es-AR', { timeZone: TZ, day: 'numeric', month: 'short' })
    .replace('.', '');
}

/** Formatea una fecha con mes en texto, ej: "16 de junio". */
export function formatFechaLarga(fecha: Date | string | number): string {
  return new Date(fecha).toLocaleDateString('es-AR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
  });
}
