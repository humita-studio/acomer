'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { formatPeso, formatFechaHora, formatHora } from '@/shared/lib/format';
import {
  abrirCajaAction,
  cerrarCajaAction,
  getCajaActualAction,
  getHistorialCajasAction,
  registrarMovimientoAction,
  type CajaActual,
  type CajaCerrada,
  type TipoMovimiento,
} from '@/features/caja/caja-actions';

const TIPO_LABEL: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  retiro: 'Retiro',
};

function Diferencia({ valor }: { valor: number }) {
  const color =
    valor === 0 ? 'text-gray-900' : valor > 0 ? 'text-green-600' : 'text-red-600';
  const signo = valor > 0 ? '+' : '';
  const etiqueta = valor === 0 ? '' : valor > 0 ? ' (sobrante)' : ' (faltante)';
  return (
    <span className={`font-black ${color}`}>
      {signo}
      {formatPeso(valor)}
      {etiqueta}
    </span>
  );
}

export function CajaManager({
  initialCaja,
  initialHistorial,
  tenantId,
}: {
  initialCaja: CajaActual | null;
  initialHistorial: CajaCerrada[];
  tenantId: string;
}) {
  const queryClient = useQueryClient();

  const { data: caja } = useQuery({
    queryKey: queryKeys.caja(tenantId),
    queryFn: () => getCajaActualAction(tenantId),
    initialData: initialCaja,
    // Mantener fresco el efectivo esperado a medida que se aprueban cobros.
    refetchInterval: 20 * 1000,
  });

  const { data: historial = initialHistorial } = useQuery({
    queryKey: queryKeys.cajaHistorial(tenantId),
    queryFn: () => getHistorialCajasAction(tenantId),
    initialData: initialHistorial,
  });

  // Refrescar el efectivo esperado cuando una mesa solicita la cuenta.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);
    channel
      .on('broadcast', { event: 'cuenta_solicitada' }, () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const invalidarCaja = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cajaHistorial(tenantId) });
  };

  // --- Abrir caja ---
  const [montoInicial, setMontoInicial] = useState('');
  const abrirMutation = useMutation({
    mutationFn: () => abrirCajaAction(Number(montoInicial)),
    onSuccess: (res) => {
      if (res.success) {
        setMontoInicial('');
        invalidarCaja();
      } else alert(res.message);
    },
  });

  // --- Movimiento ---
  const [tipoMov, setTipoMov] = useState<TipoMovimiento>('ingreso');
  const [montoMov, setMontoMov] = useState('');
  const [conceptoMov, setConceptoMov] = useState('');
  const movimientoMutation = useMutation({
    mutationFn: () =>
      registrarMovimientoAction(caja!.id, tipoMov, Number(montoMov), conceptoMov),
    onSuccess: (res) => {
      if (res.success) {
        setMontoMov('');
        setConceptoMov('');
        invalidarCaja();
      } else alert(res.message);
    },
  });

  // --- Cierre ---
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [montoContado, setMontoContado] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const cerrarMutation = useMutation({
    mutationFn: () => cerrarCajaAction(caja!.id, Number(montoContado), notasCierre),
    onSuccess: (res) => {
      if (res.success) {
        setCierreAbierto(false);
        setMontoContado('');
        setNotasCierre('');
        invalidarCaja();
      } else alert(res.message);
    },
  });

  return (
    <div className="space-y-8">
      {!caja ? (
        /* ----------------------------- Caja cerrada ----------------------------- */
        <div className="bg-white rounded-lg shadow p-8 max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Abrir caja</h2>
          <p className="text-gray-500 mb-6">
            Ingresá el monto inicial en efectivo con el que arranca el turno.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              abrirMutation.mutate();
            }}
          >
            <label className="block text-sm text-gray-600 mb-1">Monto inicial</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4"
            />
            <button
              type="submit"
              disabled={abrirMutation.isPending}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {abrirMutation.isPending ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </form>
        </div>
      ) : (
        /* ----------------------------- Caja abierta ----------------------------- */
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">
                Caja abierta desde {formatHora(caja.abiertaAt)}
              </span>
            </div>
            <button
              onClick={() => setCierreAbierto(true)}
              className="bg-gray-900 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-black transition"
            >
              Cerrar caja
            </button>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Resumen titulo="Monto inicial" valor={formatPeso(caja.montoInicial)} />
            <Resumen titulo="Ventas efectivo" valor={formatPeso(caja.ventasEfectivo)} />
            <Resumen titulo="Ingresos" valor={formatPeso(caja.ingresos)} />
            <Resumen titulo="Egresos" valor={formatPeso(caja.egresos)} />
            <Resumen titulo="Retiros" valor={formatPeso(caja.retiros)} />
            <Resumen
              titulo="Esperado en caja"
              valor={formatPeso(caja.esperadoEnCaja)}
              destacado
            />
          </div>

          <div className="text-sm text-gray-500">
            Cobros con tarjeta:{' '}
            <span className="font-semibold text-gray-700">{formatPeso(caja.ventasTarjeta)}</span>
            {' · '}Mercado Pago:{' '}
            <span className="font-semibold text-gray-700">
              {formatPeso(caja.ventasMercadoPago)}
            </span>{' '}
            (no afectan el efectivo en caja)
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form movimiento */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Registrar movimiento</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  movimientoMutation.mutate();
                }}
                className="space-y-3"
              >
                <div className="flex gap-3">
                  <select
                    value={tipoMov}
                    onChange={(e) => setTipoMov(e.target.value as TipoMovimiento)}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                    <option value="retiro">Retiro</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={montoMov}
                    onChange={(e) => setMontoMov(e.target.value)}
                    placeholder="Monto"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <input
                  type="text"
                  value={conceptoMov}
                  onChange={(e) => setConceptoMov(e.target.value)}
                  placeholder="Concepto (opcional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={movimientoMutation.isPending}
                  className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {movimientoMutation.isPending ? 'Registrando…' : 'Registrar'}
                </button>
              </form>
            </div>

            {/* Lista movimientos */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Movimientos del turno</h3>
              {caja.movimientos.length === 0 ? (
                <p className="text-gray-400 text-sm">Sin movimientos registrados.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {caja.movimientos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            m.tipo === 'ingreso'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {TIPO_LABEL[m.tipo]}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {m.concepto || '—'}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {m.tipo === 'ingreso' ? '+' : '−'}
                        {formatPeso(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------- Historial ----------------------------- */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Historial de cierres</h2>
        {historial.length === 0 ? (
          <p className="text-gray-400 text-sm">Todavía no hay cierres registrados.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Cierre</th>
                  <th className="px-4 py-3 font-medium text-right">Inicial</th>
                  <th className="px-4 py-3 font-medium text-right">Esperado</th>
                  <th className="px-4 py-3 font-medium text-right">Contado</th>
                  <th className="px-4 py-3 font-medium text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historial.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-gray-600">
                      {c.cerradaAt ? formatFechaHora(c.cerradaAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{formatPeso(c.montoInicial)}</td>
                    <td className="px-4 py-3 text-right">{formatPeso(c.montoEsperado)}</td>
                    <td className="px-4 py-3 text-right">{formatPeso(c.montoFinalContado)}</td>
                    <td className="px-4 py-3 text-right">
                      <Diferencia valor={c.diferencia} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------------------- Modal de cierre ----------------------------- */}
      {cierreAbierto && caja && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Cerrar caja</h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-4 flex justify-between items-center">
              <span className="text-gray-500">Esperado en caja</span>
              <span className="text-xl font-black text-gray-900">
                {formatPeso(caja.esperadoEnCaja)}
              </span>
            </div>

            <label className="block text-sm text-gray-600 mb-1">Monto contado (efectivo)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoContado}
              onChange={(e) => setMontoContado(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3"
              autoFocus
            />

            {montoContado !== '' && (
              <div className="mb-3 text-sm">
                Diferencia: <Diferencia valor={Number(montoContado) - caja.esperadoEnCaja} />
              </div>
            )}

            <textarea
              value={notasCierre}
              onChange={(e) => setNotasCierre(e.target.value)}
              placeholder="Notas del cierre (opcional)"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => cerrarMutation.mutate()}
                disabled={cerrarMutation.isPending || montoContado === ''}
                className="flex-1 bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition disabled:opacity-50"
              >
                {cerrarMutation.isPending ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
              <button
                onClick={() => setCierreAbierto(false)}
                disabled={cerrarMutation.isPending}
                className="px-5 py-3 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Resumen({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg shadow-sm ${
        destacado ? 'bg-blue-600 text-white' : 'bg-white'
      }`}
    >
      <p className={`text-xs ${destacado ? 'text-blue-100' : 'text-gray-500'}`}>{titulo}</p>
      <p className={`text-lg font-black mt-1 ${destacado ? 'text-white' : 'text-gray-900'}`}>
        {valor}
      </p>
    </div>
  );
}
