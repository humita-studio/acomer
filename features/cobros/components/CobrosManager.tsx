'use client';

import { useState } from 'react';
import { Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { formatPeso } from '@/shared/lib/format';
import {
  useCobrosPendientes,
  useCobrosRealtime,
  useAprobarCobro,
  useRechazarCobro,
} from '@/features/cobros/hooks/useCobros';
import type { TransaccionCobro } from '@/features/cobros/types';
import { CobroCard } from './CobroCard';
import { AprobarCobroDialog } from './AprobarCobroDialog';

export function CobrosManager({
  initialTransacciones,
  tenantId,
}: {
  initialTransacciones: TransaccionCobro[];
  tenantId: string;
}) {
  // Estado de servidor: la lista de cobros pendientes. `initialData` aprovecha
  // el fetch que ya hizo el Server Component (page.tsx), sin refetch al montar.
  const { data: transacciones = [] } = useCobrosPendientes(tenantId, initialTransacciones);

  // Realtime: cuando una mesa pide la cuenta, se invalida la query.
  useCobrosRealtime(tenantId);

  const aprobarMutation = useAprobarCobro(tenantId);
  const rechazarMutation = useRechazarCobro(tenantId);

  const [aprobarTarget, setAprobarTarget] = useState<TransaccionCobro | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<TransaccionCobro | null>(null);

  const totalPorConfirmar = transacciones.reduce((acc, tx) => acc + Number(tx.monto), 0);

  // El update optimista quita la tarjeta de inmediato, así que cerramos el modal
  // sin esperar al servidor. Si el cobro falla, la mutación revierte y reaparece.
  const handleConfirmAprobar = (vars: { id: string; montoRecibido?: number }) => {
    setAprobarTarget(null);
    aprobarMutation.mutate(vars);
  };

  const handleConfirmRechazar = () => {
    if (!rechazarTarget) return;
    rechazarMutation.mutate(rechazarTarget.id);
    setRechazarTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera con conteo en vivo */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Cobros</h1>
          <p className="mt-1 text-muted-foreground">
            {transacciones.length} cobro{transacciones.length === 1 ? '' : 's'} pendiente
            {transacciones.length === 1 ? '' : 's'} de aprobar · {formatPeso(totalPorConfirmar)} por
            confirmar
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-success" />
          En tiempo real
        </span>
      </div>

      {/* Grilla de cobros / estado vacío */}
      {transacciones.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Receipt className="size-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No hay cobros pendientes</h3>
          <p className="mt-1 max-w-sm text-muted-foreground">
            Cuando una mesa pida pagar en efectivo o con tarjeta, el cobro aparecerá acá para que lo
            confirmes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {transacciones.map((tx) => (
            <CobroCard
              key={tx.id}
              tx={tx}
              onAprobar={setAprobarTarget}
              onRechazar={setRechazarTarget}
            />
          ))}
        </div>
      )}

      {/* Modal de aprobación */}
      <AprobarCobroDialog
        tx={aprobarTarget}
        open={!!aprobarTarget}
        onOpenChange={(o) => !o && setAprobarTarget(null)}
        onConfirm={handleConfirmAprobar}
      />

      {/* Confirmación de rechazo */}
      <Dialog open={!!rechazarTarget} onOpenChange={(o) => !o && setRechazarTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Rechazar este cobro?</DialogTitle>
            <DialogDescription>
              {rechazarTarget ? `El cobro de la mesa ${rechazarTarget.mesaIdentificador} se marca como rechazado. ` : ''}
              La mesa seguirá abierta para volver a cobrar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmRechazar}>
              Rechazar cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
