// Lógica de rangos de fechas de Reportes. Los cálculos de presets y etiquetas
// operan sobre strings YYYY-MM-DD (sin Date) para evitar corrimientos de zona
// horaria; `parseYmd`/`ymd` convierten desde/hacia Date para el calendario.

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export type Preset = 'hoy' | '7d' | '30d' | 'mes';

export const PRESETS: { value: Preset; label: string; largo: string }[] = [
  { value: 'hoy', label: 'Hoy', largo: 'Hoy' },
  { value: '7d', label: '7 días', largo: 'Últimos 7 días' },
  { value: '30d', label: '30 días', largo: 'Últimos 30 días' },
  { value: 'mes', label: 'Este mes', largo: 'Este mes' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date (hora local) → "YYYY-MM-DD". */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "YYYY-MM-DD" → Date a medianoche local (sin conversión de zona). */
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDias = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
export const ddmmaaaa = (s: string) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

export function rangoPreset(p: Preset, hoy: string): { desde: string; hasta: string } {
  switch (p) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case '7d':
      return { desde: addDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: addDias(hoy, -29), hasta: hoy };
    case 'mes': {
      const [y, m] = hoy.split('-');
      return { desde: `${y}-${m}-01`, hasta: hoy };
    }
  }
}

/** Preset que coincide con el rango, o '' si es un rango libre. */
export function detectarPreset(desde: string, hasta: string, hoy: string): Preset | '' {
  for (const { value } of PRESETS) {
    const r = rangoPreset(value, hoy);
    if (r.desde === desde && r.hasta === hasta) return value;
  }
  return '';
}

/** "Del 1 al 18 de junio de 2026", colapsando mes/año cuando coinciden. */
export function rangoTexto(desde: string, hasta: string): string {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  if (desde === hasta) return `${d1} de ${MESES[m1 - 1]} de ${y1}`;
  if (y1 === y2 && m1 === m2) return `Del ${d1} al ${d2} de ${MESES[m1 - 1]} de ${y1}`;
  if (y1 === y2) return `Del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${y1}`;
  return `Del ${ddmmaaaa(desde)} al ${ddmmaaaa(hasta)}`;
}

/** Cantidad de días del rango (inclusivo). */
export function cantidadDias(desde: string, hasta: string): number {
  const ms = parseYmd(hasta).getTime() - parseYmd(desde).getTime();
  return Math.round(ms / 86_400_000) + 1;
}
