'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { queryKeys } from '@/shared/query/keys';
import { formatPeso } from '@/shared/lib/format';
import { getReporteAction, type ReporteData } from '@/features/reportes/reportes-actions';

const PROVEEDOR_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_fisica: 'Tarjeta física',
  mercado_pago: 'Mercado Pago',
  mock: 'Prueba',
};

const COLORES = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2'];

function Card({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function GraficoVacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
      {mensaje}
    </div>
  );
}

export function ReportesManager({
  initialData,
  tenantId,
  desdeInicial,
  hastaInicial,
}: {
  initialData: ReporteData;
  tenantId: string;
  desdeInicial: string;
  hastaInicial: string;
}) {
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);

  const { data: reporte = initialData, isFetching } = useQuery({
    queryKey: queryKeys.reportes(tenantId, desde, hasta),
    queryFn: () => getReporteAction(tenantId, desde, hasta),
    initialData:
      desde === desdeInicial && hasta === hastaInicial ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  const { resumen, ventasPorDia, ventasPorMetodo, topProductos, ocupacionPorHora } = reporte;
  const metodos = ventasPorMetodo.map((m) => ({
    ...m,
    label: PROVEEDOR_LABEL[m.proveedor] ?? m.proveedor,
  }));

  return (
    <div className="space-y-6">
      {/* Selector de rango */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        {isFetching && <span className="text-sm text-gray-400 pb-2">Actualizando…</span>}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card titulo="Ventas totales" valor={formatPeso(resumen.totalVentas)} />
        <Card titulo="Cobros" valor={String(resumen.cantidadCobros)} />
        <Card titulo="Ticket promedio" valor={formatPeso(resumen.ticketPromedio)} />
        <Card titulo="Mesas atendidas" valor={String(resumen.mesasAtendidas)} />
        <Card
          titulo="Ocupación promedio"
          valor={`${resumen.tiempoPromedioOcupacionMin} min`}
          sub="por mesa cerrada"
        />
      </div>

      {/* Ventas por día + por método */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Ventas por día</h2>
          {ventasPorDia.length === 0 ? (
            <GraficoVacio mensaje="Sin ventas en el período" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ventasPorDia} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  width={70}
                  tickFormatter={(v) => formatPeso(v as number)}
                />
                <Tooltip formatter={(value) => formatPeso(value as number)} />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white p-5 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Ventas por método</h2>
          {metodos.length === 0 ? (
            <GraficoVacio mensaje="Sin ventas en el período" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={metodos}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                >
                  {metodos.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(value) => formatPeso(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top productos + ocupación por hora */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Top productos</h2>
          {topProductos.length === 0 ? (
            <GraficoVacio mensaje="Sin productos vendidos" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductos} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cantidad" name="Cantidad" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white p-5 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Ocupación por hora</h2>
          {ocupacionPorHora.length === 0 ? (
            <GraficoVacio mensaje="Sin sesiones en el período" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ocupacionPorHora} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 12 }} tickFormatter={(h) => `${h}h`} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={30} />
                <Tooltip labelFormatter={(h) => `${h}:00 hs`} />
                <Bar dataKey="sesiones" name="Sesiones" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
