'use client';

import { ChevronDown, MapPinned } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { Reserva } from '../types';

/**
 * Trigger que abre el diálogo de asignación de mesa (plano + lista).
 * Mantiene el nombre del módulo por compatibilidad con ReservaCard.
 */
export function AsignarMesaTrigger({
  reserva,
  onOpen,
  disabled,
}: {
  reserva: Reserva;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const label = reserva.mesaIdentificador
    ? `Mesa ${reserva.mesaIdentificador}`
    : reserva.mesaId
      ? 'Mesa asignada'
      : 'Asignar mesa';

  return (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={onOpen}>
      <MapPinned className="size-3.5 opacity-70" />
      {label}
      <ChevronDown className="text-muted-foreground" />
    </Button>
  );
}

/** @deprecated Preferir AsignarMesaTrigger + AsignarMesaDialog. */
export { AsignarMesaTrigger as AsignarMesaPopover };
