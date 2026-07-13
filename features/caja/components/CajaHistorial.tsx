'use client';

import {
  formatPeso,
  formatHora,
  formatFechaCorta,
} from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { CajaCerrada } from '@/features/caja/types';

function DiferenciaText({ valor }: { valor: number }) {
  if (valor === 0) {
    return <span className="text-muted-foreground">0</span>;
  }
  return (
    <span className={cn(valor > 0 ? 'text-success-foreground' : 'text-destructive')}>
      {valor > 0 ? '+' : '−'}
      {formatPeso(Math.abs(valor))}
    </span>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={cn(
        'pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
        align === 'right' && 'text-right',
      )}
    >
      {children}
    </th>
  );
}

/** Tabla de cierres de caja (extraída de CajaManager). */
export function CajaHistorial({
  historial,
  onSelect,
}: {
  historial: CajaCerrada[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de cierres</CardTitle>
      </CardHeader>
      <CardContent>
        {historial.length === 0 ? (
          <div className="space-y-1 py-2">
            <p className="text-sm font-medium text-foreground">Sin cierres todavía</p>
            <p className="text-sm text-muted-foreground">
              Cuando cierres el turno, el arqueo (esperado vs contado) queda acá para revisarlo.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Cierre</Th>
                <Th align="right">Inicial</Th>
                <Th align="right">Esperado</Th>
                <Th align="right">Contado</Th>
                <Th align="right">Diferencia</Th>
              </tr>
            </thead>
            <tbody>
              {historial.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/50"
                >
                  <td className="py-3 font-medium">
                    {c.cerradaAt
                      ? `${formatFechaCorta(c.cerradaAt)} · ${formatHora(c.cerradaAt)}`
                      : '—'}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {formatPeso(c.montoInicial)}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {formatPeso(c.montoEsperado)}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {formatPeso(c.montoFinalContado)}
                  </td>
                  <td className="py-3 text-right">
                    <DiferenciaText valor={c.diferencia} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
