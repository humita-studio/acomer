'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { formatPeso } from '@/shared/lib/format';
import { getDashboardMetricsAction, type DashboardMetrics } from '@/features/dashboard/dashboard-actions';

export function DashboardMetrics({
  initialData,
  tenantId,
  role,
}: {
  initialData: DashboardMetrics;
  tenantId: string;
  role: RoleType;
}) {
  const queryClient = useQueryClient();

  const { data: metrics = initialData } = useQuery({
    queryKey: queryKeys.dashboard(tenantId),
    queryFn: () => getDashboardMetricsAction(tenantId),
    initialData,
    // La ocupación y los pedidos cambian seguido: refrescamos cada 30s además del realtime.
    refetchInterval: 30 * 1000,
  });

  // Realtime: invalidamos las métricas cuando cambia la ocupación o se solicita una cuenta.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    const invalidar = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(tenantId) });

    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, invalidar)
      .on('broadcast', { event: 'cuenta_solicitada' }, invalidar)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const puedeVerVentas = hasPermission(role, 'canViewReports');
  const { ocupacion, ventasHoy, pedidosActivos } = metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Ocupación en vivo */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">🪑 Ocupación</h2>
          <span className="text-2xl font-black text-blue-600">{ocupacion.porcentaje}%</span>
        </div>
        <p className="text-gray-600 mb-3">
          {ocupacion.mesasOcupadas} de {ocupacion.totalMesas} mesas ocupadas
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all"
            style={{ width: `${ocupacion.porcentaje}%` }}
          />
        </div>
      </div>

      {/* Ventas de hoy (sensible: sólo roles con permiso de reportes) */}
      {puedeVerVentas && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">💵 Ventas de hoy</h2>
          <p className="text-3xl font-black text-gray-900">{formatPeso(ventasHoy.total)}</p>
          <div className="mt-3 flex justify-between text-sm text-gray-500">
            <span>{ventasHoy.cantidadCobros} cobros</span>
            <span>Ticket prom. {formatPeso(ventasHoy.ticketPromedio)}</span>
          </div>
        </div>
      )}

      {/* Pedidos activos */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">🛒 Pedidos activos</h2>
          <span className="text-2xl font-black text-gray-900">{pedidosActivos.total}</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">⏳ Pendientes</span>
            <span className="font-bold">{pedidosActivos.pendiente}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">👨‍🍳 En preparación</span>
            <span className="font-bold">{pedidosActivos.enPreparacion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">✅ Listos</span>
            <span className="font-bold">{pedidosActivos.listo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
