// Modelo de dominio del dashboard. Fuente única de tipos compartidos entre el
// action que los calcula, el hook y los componentes.

export type Periodo = 'hoy' | 'semana' | 'mes';
export type SerieModo = 'hora' | 'dia';

export type CanalPedido = 'salon' | 'takeaway' | 'delivery' | 'mostrador' | 'otro';

export type PedidoReciente = {
  id: string;
  ref: string; // referencia corta, ej "#3F1A"
  canal: CanalPedido;
  canalLabel: string; // "Mesa 7" | "Delivery" | "Takeaway"
  items: number;
  total: number;
  estado: string;
  hora: string; // ISO
};

export type PuntoSerie = { label: string; total: number };

export type DashboardMetrics = {
  periodo: Periodo;
  ocupacion: { mesasOcupadas: number; totalMesas: number; porcentaje: number };
  ventas: {
    total: number;
    cantidadCobros: number;
    ticketPromedio: number;
    deltaTotalPct: number | null;
    deltaTicketPct: number | null;
  };
  pedidos: { total: number; deltaPct: number | null };
  salon: { ocupadas: number; reservadas: number; libres: number; total: number };
  serie: { modo: SerieModo; puntos: PuntoSerie[] };
  pedidosRecientes: PedidoReciente[];
};
