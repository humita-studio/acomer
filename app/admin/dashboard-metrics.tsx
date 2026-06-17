'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, DollarSign, ShoppingCart } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { formatPeso } from '@/shared/lib/format';
import { getDashboardMetricsAction, type DashboardMetrics } from '@/features/dashboard/dashboard-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
            <Armchair className="size-4" />
            Ocupación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tabular-nums">{ocupacion.porcentaje}%</span>
            <span className="text-sm text-muted-foreground">
              {ocupacion.mesasOcupadas} de {ocupacion.totalMesas} mesas
            </span>
          </div>
          <Progress value={ocupacion.porcentaje} />
        </CardContent>
      </Card>

      {/* Ventas de hoy (sensible: sólo roles con permiso de reportes) */}
      {puedeVerVentas && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <DollarSign className="size-4" />
              Ventas de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold tabular-nums">{formatPeso(ventasHoy.total)}</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{ventasHoy.cantidadCobros} cobros</span>
              <span>Ticket prom. {formatPeso(ventasHoy.ticketPromedio)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pedidos activos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
            <ShoppingCart className="size-4" />
            Pedidos activos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <span className="text-3xl font-bold tabular-nums">{pedidosActivos.total}</span>
          <div className="space-y-2 pt-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendientes</span>
              <span className="font-semibold tabular-nums">{pedidosActivos.pendiente}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">En preparación</span>
              <span className="font-semibold tabular-nums">{pedidosActivos.enPreparacion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Listos</span>
              <span className="font-semibold tabular-nums">{pedidosActivos.listo}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
