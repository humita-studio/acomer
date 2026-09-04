export type OrigenResena = 'mesa' | 'delivery' | 'mostrador' | 'directo';
export type EstadoResena = 'nuevo' | 'leido' | 'contactado' | 'resuelto';

export type AspectoCritica =
  | 'demora'
  | 'atencion'
  | 'comida_fria'
  | 'ambiente_ruido'
  | 'precio_cuenta'
  | 'otro';

export const ASPECTOS_LABELS: Record<AspectoCritica, string> = {
  demora: 'Demora en la comida',
  atencion: 'Atención del mozo/personal',
  comida_fria: 'Comida fría o plato incorrecto',
  ambiente_ruido: 'Ambiente / Ruido / Limpieza',
  precio_cuenta: 'Precios o error en la cuenta',
  otro: 'Otro motivo',
};

export type ConfiguracionResenasDto = {
  googleReviewUrl: string;
  resenasActivas: boolean;
  minEstrellasGoogle: number;
  recibirAlertaNegativa: boolean;
};

export type ResenaClienteDto = {
  id: string;
  origen: OrigenResena;
  mesaId: string | null;
  pedidoId: string | null;
  identificadorMesa: string | null;
  estrellas: number;
  aspectos: string[];
  comentario: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  derivadaAGoogle: boolean;
  estado: EstadoResena;
  createdAt: Date;
};

export type ResenasMetricsDto = {
  promedio: number;
  total: number;
  derivadasGoogle: number;
  privadasNegativas: number;
  distribucionEstrellas: Record<number, number>;
  topAspectos: { aspecto: string; label: string; count: number }[];
};

export type EnviarFeedbackInput = {
  slug: string;
  estrellas: number;
  origen?: OrigenResena;
  mesaId?: string | null;
  pedidoId?: string | null;
  identificadorMesa?: string | null;
  aspectos?: string[];
  comentario?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
};

export type EnviarFeedbackResult = {
  success: boolean;
  message?: string;
  derivadaAGoogle: boolean;
  googleReviewUrl?: string | null;
};
