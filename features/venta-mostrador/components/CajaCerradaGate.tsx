'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';

/**
 * Pantalla de bloqueo cuando se intenta una venta de mostrador sin caja abierta.
 * Las ventas de mostrador se asocian al turno de caja: sin sesión no se puede cobrar.
 */
export function CajaCerradaGate({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="space-y-5 p-6 text-center sm:max-w-md">
      <DialogTitle className="sr-only">Caja cerrada</DialogTitle>
      <DialogDescription className="sr-only">
        Necesitás abrir la caja antes de registrar una venta de mostrador.
      </DialogDescription>

      <div className="flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning-subtle text-warning-foreground">
          <Wallet className="size-7" />
        </span>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">Abrí la caja primero</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Para registrar una venta rápida tenés que tener una sesión de caja abierta. Así el cobro
          queda en el turno y el arqueo cierra bien.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/admin/caja" onClick={onCerrar}>
            <Wallet className="size-4" />
            Ir a Caja
          </Link>
        </Button>
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
