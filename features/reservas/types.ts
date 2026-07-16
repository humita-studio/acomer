// Modelo de dominio de la agenda de reservas.
// La config de reservas (shape + defaults) vive en `reservasConfig.ts`.

export type Reserva = {
  id: string;
  nombreContacto: string;
  telefono: string;
  mesaId: string | null;
  /** Identificador legible de la mesa (join); null si no hay mesa asignada. */
  mesaIdentificador?: string | null;
  mesaCapacidad?: number | null;
  inicio: string | Date;
  duracionMin: number;
  cantidadPersonas: number;
  estado: string;
  notas: string | null;
};

export type Mesa = { id: string; identificador: string; capacidad: number };
