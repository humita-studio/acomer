// Constantes y tipos compartidos del editor de plano

export const GRID_PX = 24; // px por celda de la cuadrícula
export const COLS = 40; // ancho lógico del lienzo (celdas)
export const ROWS = 30; // alto lógico del lienzo (celdas)

export type Forma = 'cuadrada' | 'redonda';
export type TipoElemento = 'pared' | 'barra' | 'contorno' | 'decoracion';
export type Modo = 'ver' | 'editar';
export type Herramienta = 'seleccionar' | 'pared' | 'barra';

export interface MesaPlano {
  id: string;
  identificador: string;
  ambienteId: string | null;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  forma: string;
  capacidad: number;
  rotacion: number;
  ocupada?: boolean;
}

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
