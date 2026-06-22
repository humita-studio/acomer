'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { VentaMostradorFlow } from './VentaMostradorFlow';

/** Botón del header del admin: abre el flujo de venta de mostrador. */
export function NuevaVentaButton({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ShoppingCart />
        <span className="max-sm:sr-only">Nueva venta</span>
      </Button>
      {open && <VentaMostradorFlow tenantId={tenantId} onOpenChange={setOpen} />}
    </>
  );
}
