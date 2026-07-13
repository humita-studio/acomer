// Constantes y tipos compartidos del editor de plano

export const GRID_PX = 24; // px por celda a tamaño completo (tope superior)
export const MIN_CELL = 8; // px mínimos por celda al achicar en pantallas chicas
export const COLS = 40; // ancho lógico del lienzo (celdas)
export const ROWS = 30; // alto lógico del lienzo (celdas)

/** Tamaño por defecto de una mesa nueva (celdas). */
export const MESA_DEFAULT_ANCHO = 2;
export const MESA_DEFAULT_ALTO = 2;
export const MESA_DEFAULT_CAPACIDAD = 4;

/** Snap por defecto: media celda (fácil de alinear sin quedar “libre” desordenado). */
export const SNAP_STEP = 0.5;
/** Paso fino al redimensionar con steppers / nudge con flechas. */
export const FINE_STEP = 0.5;
/** Nudge con Shift: un paso más grande. */
export const COARSE_STEP = 1;

export type Forma = 'cuadrada' | 'redonda';
export type TipoElemento = 'pared' | 'barra' | 'contorno' | 'decoracion';
export type Modo = 'ver' | 'editar';
/** `mesa` = click en el lienzo para colocar una mesa en ese punto. */
export type Herramienta = 'seleccionar' | 'mesa' | 'pared' | 'barra' | 'linea';

export const LINE_THICKNESS = 0.28; // grosor (en celdas) de las paredes dibujadas como línea
/** Snap de ángulos al dibujar / rotar (grados). */
export const ANGLE_SNAP = 15;

/** Redondea a 2 decimales (evita ruido de float). */
export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Snap a múltiplos de `step` (por defecto media celda). */
export function snapTo(n: number, step = SNAP_STEP) {
  if (step <= 0) return round2(n);
  return round2(Math.round(n / step) * step);
}

/** Normaliza grados a [0, 360). */
export function normalizeDeg(deg: number) {
  if (!Number.isFinite(deg)) return 0;
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** Snap de ángulo a múltiplos de `step` grados. */
export function snapAngle(deg: number, step = ANGLE_SNAP) {
  if (step <= 0) return normalizeDeg(deg);
  return normalizeDeg(Math.round(deg / step) * step);
}

/**
 * Rectángulo fino rotado que representa un segmento de pared A→B.
 * El centro del rect cae en el medio de la línea.
 */
export function lineaARect(ax: number, ay: number, bx: number, by: number, thickness = LINE_THICKNESS) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  return {
    posX: cx - len / 2,
    posY: cy - thickness / 2,
    ancho: len,
    alto: thickness,
    rot: normalizeDeg(rot),
  };
}

/**
 * Ajusta el extremo B de un segmento para que el ángulo sea múltiplo de `stepDeg`
 * (útil para paredes horizontales / verticales / 45° sin pelear con el mouse).
 */
export function snapLineEnd(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  stepDeg = ANGLE_SNAP,
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: bx, y: by };
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  return {
    x: ax + Math.cos(snapped) * len,
    y: ay + Math.sin(snapped) * len,
  };
}

export interface MesaPlano {
  id: string;
  identificador: string;
  qrToken: string;
  parentMesaId: string | null;
  ambienteId: string | null;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  forma: string;
  capacidad: number;
  rotacion: number;
  ocupada?: boolean;
  /** auth.users id del mozo asignado. */
  mozoUserId: string | null;
}

/** Filtro de mesas por mozo en modo operación. */
export type FiltroMozo = 'todas' | 'mias' | 'sin_asignar' | string; // string = userId de un mozo

export interface ElementoPlanoUI {
  id: string;
  ambienteId: string;
  tipo: string;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion: number;
  etiqueta: string | null;
}

export interface AmbienteUI {
  id: string;
  nombre: string;
  orden: number;
}

export interface Seleccion {
  tipo: 'mesa' | 'elemento';
  id: string;
}
