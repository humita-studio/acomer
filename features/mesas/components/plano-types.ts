// Constantes y tipos compartidos del editor de plano

export const GRID_PX = 24; // px por celda a tamaño completo (tope superior)
export const MIN_CELL = 8; // px mínimos por celda al achicar en pantallas chicas
export const COLS = 40; // ancho lógico del lienzo (celdas)
export const ROWS = 30; // alto lógico del lienzo (celdas)

export type Forma = 'cuadrada' | 'redonda';
export type TipoElemento = 'pared' | 'barra' | 'contorno' | 'decoracion';
export type Modo = 'ver' | 'editar';
export type Herramienta = 'seleccionar' | 'pared' | 'barra' | 'linea';

export const LINE_THICKNESS = 0.35; // grosor (en celdas) de las paredes dibujadas como línea

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
