// Tipos y defaults de la config de reservas. Módulo plano (sin 'use server' ni
// `db`) para poder importarse tanto desde server actions como desde componentes
// cliente sin arrastrar dependencias de servidor.

/**
 * Un turno es una franja con nombre y rango horario (ej. "Almuerzo" 12:00–15:30,
 * "Cena" 20:00–00:00). Un rango con `hasta <= desde` se interpreta cruzando la
 * medianoche (la "Cena" 20:00–00:00 cubre 20:00…23:59).
 */
export type Turno = {
  nombre: string;
  desde: string; // 'HH:MM'
  hasta: string; // 'HH:MM'
  activo: boolean;
};

export type ReservasConfig = {
  activo: boolean; // aceptar reservas desde la web
  turnos: Turno[];
  duracionMinDefault: number;
  anticipacionMinMin: number; // anticipación mínima (min) para reservar; 0 = sin mínimo
  cupoCubiertosPorTurno: number | null; // cubiertos máximos por turno; null = sin límite
  maxReservasPorDia: number | null; // tope de reservas/día; null = sin límite
};

/** Paso (min) con el que se generan los horarios concretos de cada turno. */
export const INTERVALO_SLOT_MIN = 30;

/** Defaults usados cuando el restaurante no tiene fila de config todavía. */
export const RESERVAS_CONFIG_DEFAULT: ReservasConfig = {
  // Off hasta que el dueño lo active (evita reservas sin turnos pensados).
  activo: false,
  turnos: [
    { nombre: 'Almuerzo', desde: '12:00', hasta: '15:30', activo: true },
    { nombre: 'Cena', desde: '20:00', hasta: '00:00', activo: true },
  ],
  duracionMinDefault: 90,
  anticipacionMinMin: 120,
  cupoCubiertosPorTurno: null,
  maxReservasPorDia: null,
};

/** Opciones de duración por defecto que ofrece el drawer de configuración. */
export const DURACION_OPCIONES: { min: number; label: string }[] = [
  { min: 60, label: '1 hora' },
  { min: 90, label: '1 h 30 min' },
  { min: 120, label: '2 horas' },
  { min: 150, label: '2 h 30 min' },
  { min: 180, label: '3 horas' },
];

/** Opciones de anticipación mínima que ofrece el drawer de configuración. */
export const ANTICIPACION_OPCIONES: { min: number; label: string }[] = [
  { min: 0, label: 'Sin anticipación' },
  { min: 30, label: '30 minutos antes' },
  { min: 60, label: '1 hora antes' },
  { min: 120, label: '2 horas antes' },
  { min: 180, label: '3 horas antes' },
  { min: 1440, label: '1 día antes' },
];

/** 'HH:MM' → minutos desde la medianoche. Devuelve null si no es válido. */
export function horaAMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** minutos desde la medianoche → 'HH:MM'. */
export function minAHora(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Expande los turnos activos en horarios concretos 'HH:MM' (cada `intervalo`
 * minutos), ordenados y sin duplicados. Lo consumen los selects de horario del
 * form público y del modal "Nueva reserva".
 */
export function expandirTurnos(turnos: Turno[], intervalo = INTERVALO_SLOT_MIN): string[] {
  const slots = new Set<string>();
  for (const t of turnos) {
    if (!t.activo) continue;
    const ini = horaAMin(t.desde);
    let fin = horaAMin(t.hasta);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440; // cruza medianoche
    for (let m = ini; m < fin; m += intervalo) slots.add(minAHora(m));
  }
  return [...slots].sort((a, b) => (horaAMin(a)! - horaAMin(b)!));
}

/** Horarios concretos de un turno, para mostrarlos agrupados en un select. */
export type TurnoSlots = { nombre: string; slots: string[] };

/**
 * Turnos activos con sus horarios concretos, para el select agrupado del form
 * público (cada grupo = un turno con nombre, ej. "Almuerzo" → 12:00, 12:30…).
 */
export function turnosConSlots(turnos: Turno[], intervalo = INTERVALO_SLOT_MIN): TurnoSlots[] {
  return turnos
    .filter((t) => t.activo)
    .map((t) => ({ nombre: t.nombre, slots: expandirTurnos([t], intervalo) }))
    .filter((g) => g.slots.length > 0);
}

/**
 * Devuelve el turno (activo o no) al que pertenece un horario 'HH:MM', o null si
 * no cae en ninguno. Lo usa el cálculo de cupo por turno.
 */
export function turnoDeHora(turnos: Turno[], hhmm: string): Turno | null {
  const t = horaAMin(hhmm);
  if (t == null) return null;
  for (const turno of turnos) {
    const ini = horaAMin(turno.desde);
    let fin = horaAMin(turno.hasta);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440;
    // Probamos el horario tal cual y +24h (para rangos que cruzan medianoche).
    if ((t >= ini && t < fin) || (t + 1440 >= ini && t + 1440 < fin)) return turno;
  }
  return null;
}
