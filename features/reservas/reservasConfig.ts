// Tipos y defaults de la config de reservas. Módulo plano (sin 'use server' ni
// `db`) para poder importarse tanto desde server actions como desde componentes
// cliente sin arrastrar dependencias de servidor.

export type ReservasConfig = {
  activo: boolean;
  turnos: string[]; // 'HH:MM'
  duracionMinDefault: number;
  cupoCubiertosPorTurno: number | null; // null = sin límite
  maxReservasPorDia: number | null; // null = sin límite
};

/** Defaults usados cuando el restaurante no tiene fila de config todavía. */
export const RESERVAS_CONFIG_DEFAULT: ReservasConfig = {
  activo: true,
  turnos: ['12:00', '12:30', '13:00', '13:30', '14:00', '20:00', '20:30', '21:00', '21:30', '22:00'],
  duracionMinDefault: 90,
  cupoCubiertosPorTurno: null,
  maxReservasPorDia: null,
};
