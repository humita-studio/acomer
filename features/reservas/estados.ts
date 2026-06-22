// Metadatos de presentación de los estados de una reserva. Módulo plano:
// clases con tokens del design system (sin colores hardcodeados).

export type EstadoReserva =
  | 'Pendiente'
  | 'Confirmada'
  | 'Sentada'
  | 'NoShow'
  | 'Cancelada'
  | 'Cumplida';

export const ESTADO_META: Record<string, { label: string; pill: string; dot: string }> = {
  Pendiente: { label: 'Pendiente', pill: 'bg-warning-subtle text-warning-foreground', dot: 'bg-warning' },
  Confirmada: { label: 'Confirmada', pill: 'bg-accent text-accent-foreground', dot: 'bg-primary' },
  Sentada: { label: 'Sentada', pill: 'bg-success-subtle text-success-foreground', dot: 'bg-success' },
  NoShow: { label: 'No-show', pill: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  Cancelada: { label: 'Cancelada', pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  Cumplida: { label: 'Cumplida', pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export function estadoMeta(estado: string) {
  return ESTADO_META[estado] ?? ESTADO_META.Pendiente;
}
