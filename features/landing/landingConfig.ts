// Tipos, defaults y helpers puros de la landing pública del local. Módulo plano
// (sin 'use server' ni `db`) para importarse tanto desde server actions como
// desde componentes cliente sin arrastrar dependencias de servidor.

export type ColorMarca = 'terracota' | 'ambar' | 'verde';

export type TurnoHorario = {
  desde: string; // 'HH:MM'
  hasta: string; // 'HH:MM' (si <= desde, se interpreta cruzando la medianoche)
};

/** Atención de un día: si está cerrado o sus turnos horarios. */
export type HorarioDia = {
  cerrado: boolean;
  turnos: TurnoHorario[];
};

/** Qué tarjetas ofrece la landing. */
export type AccionesLanding = {
  verCarta: boolean;
  pedirOnline: boolean;
  reservar: boolean;
  qr: boolean;
};

export type RedesLanding = {
  whatsapp: string; // solo dígitos (con código de país), ej. '5491122334455'
  instagram: string; // usuario sin @
  telefono: string;
};

export type LandingConfig = {
  descripcion: string;
  direccion: string;
  // 7 días indexados por getDay() (0=Dom … 6=Sáb).
  horarios: HorarioDia[];
  acciones: AccionesLanding;
  colorMarca: ColorMarca;
  redes: RedesLanding;
  /** URL optimizada de la portada (Cloudinary f_auto,q_auto). Vacío = solo gradiente. */
  imagenUrl: string;
  /** public_id en Cloudinary para reemplazar/borrar. */
  imagenPublicId: string;
};

const HORARIO_DIA_DEFAULT: HorarioDia = { cerrado: false, turnos: [{ desde: '12:00', hasta: '00:00' }] };

/** Defaults usados cuando el restaurante no tiene fila de config todavía. */
export const LANDING_CONFIG_DEFAULT: LandingConfig = {
  descripcion: '',
  direccion: '',
  horarios: Array.from({ length: 7 }, () => ({ ...HORARIO_DIA_DEFAULT, turnos: [...HORARIO_DIA_DEFAULT.turnos] })),
  acciones: { verCarta: true, pedirOnline: true, reservar: true, qr: true },
  colorMarca: 'terracota',
  redes: { whatsapp: '', instagram: '', telefono: '' },
  imagenUrl: '',
  imagenPublicId: '',
};

export const COLORES_MARCA: { value: ColorMarca; label: string }[] = [
  { value: 'terracota', label: 'Terracota' },
  { value: 'ambar', label: 'Ámbar' },
  { value: 'verde', label: 'Verde' },
];

/**
 * Días en orden de presentación (Lun→Dom) con su índice de `getDay()`. Se usa
 * para listar el editor de horarios; el almacenamiento sigue indexado por
 * getDay() (0=Dom).
 */
export const DIAS_SEMANA: { dow: number; label: string; corto: string }[] = [
  { dow: 1, label: 'Lunes', corto: 'Lun' },
  { dow: 2, label: 'Martes', corto: 'Mar' },
  { dow: 3, label: 'Miércoles', corto: 'Mié' },
  { dow: 4, label: 'Jueves', corto: 'Jue' },
  { dow: 5, label: 'Viernes', corto: 'Vie' },
  { dow: 6, label: 'Sábado', corto: 'Sáb' },
  { dow: 0, label: 'Domingo', corto: 'Dom' },
];

/** Zona horaria del local (los horarios se interpretan en hora de Argentina). */
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/** Gradiente del hero por color de marca (usado como `style.background`). */
export const GRADIENTE_MARCA: Record<ColorMarca, string> = {
  terracota: 'linear-gradient(155deg, #c2562f 0%, #6b2f18 55%, #2c1610 100%)',
  ambar: 'linear-gradient(155deg, #e0992a 0%, #8a560f 55%, #382506 100%)',
  verde: 'linear-gradient(155deg, #3f9b5e 0%, #235c39 55%, #112c1c 100%)',
};

/** Color sólido de la marca, oscuro lo suficiente para texto blanco encima. */
export const SOLIDO_MARCA: Record<ColorMarca, string> = {
  terracota: '#c2562f',
  ambar: '#b5731a',
  verde: '#2f7e49',
};

// ---------------------------------------------------------------------------
// Helpers de tiempo (puros). Inlined para mantener el feature autocontenido.
// ---------------------------------------------------------------------------

/** 'HH:MM' → minutos desde la medianoche. Devuelve null si no es válido. */
export function horaAMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** 'HH:MM' válido y normalizado a 2 dígitos, o null. */
export function normalizarHora(h: unknown): string | null {
  if (typeof h !== 'string') return null;
  const min = horaAMin(h);
  if (min == null) return null;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Día de la semana (0=Dom) y minutos del día en una zona horaria dada. */
export type AhoraLocal = { dow: number; min: number };

const DOW_POR_NOMBRE: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Hora actual (día de semana + minutos) en una zona horaria. Usa `Intl`, que
 * funciona igual en server y cliente, así el estado "Abierto" refleja la hora
 * del local sin importar dónde esté el visitante.
 */
export function ahoraLocal(tz: string = ZONA_HORARIA, date: Date = new Date()): AhoraLocal {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  let dow = date.getUTCDay();
  let hh = 0;
  let mm = 0;
  for (const p of partes) {
    if (p.type === 'weekday') dow = DOW_POR_NOMBRE[p.value] ?? dow;
    else if (p.type === 'hour') hh = Number(p.value) % 24;
    else if (p.type === 'minute') mm = Number(p.value);
  }
  return { dow, min: hh * 60 + mm };
}

/** Rango [ini, fin) en minutos de un día (fin se extiende si cruza medianoche). */
function rango(t: TurnoHorario): { ini: number; fin: number } | null {
  const ini = horaAMin(t.desde);
  let fin = horaAMin(t.hasta);
  if (ini == null || fin == null) return null;
  if (fin <= ini) fin += 1440; // cruza medianoche
  return { ini, fin };
}

/**
 * ¿El local está abierto en `ahora`? Considera el rango de hoy y el de ayer
 * cuando cruza la medianoche (ej. abierto hasta las 02:00 sigue contando a la
 * 01:00 del día siguiente).
 */
export function estaAbierto(horarios: HorarioDia[], ahora: AhoraLocal): boolean {
  const hoy = horarios[ahora.dow];
  if (hoy && !hoy.cerrado && hoy.turnos) {
    for (const t of hoy.turnos) {
      const r = rango(t);
      if (r && ahora.min >= r.ini && ahora.min < r.fin) return true;
    }
  }
  const ayer = horarios[(ahora.dow + 6) % 7];
  if (ayer && !ayer.cerrado && ayer.turnos) {
    for (const t of ayer.turnos) {
      const r = rango(t);
      if (r && r.fin > 1440 && ahora.min + 1440 >= r.ini && ahora.min + 1440 < r.fin) return true;
    }
  }
  return false;
}

/** Texto del horario de hoy para el hero: "Hoy 12:00–00:00" o "Cerrado hoy". */
export function horarioDeHoy(horarios: HorarioDia[], ahora: AhoraLocal): string {
  const hoy = horarios[ahora.dow];
  if (!hoy || hoy.cerrado || !hoy.turnos || hoy.turnos.length === 0) return 'Cerrado hoy';
  return `Hoy ${hoy.turnos.map((t) => `${t.desde}–${t.hasta}`).join(', ')}`;
}
