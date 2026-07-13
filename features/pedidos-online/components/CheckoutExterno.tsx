'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { getCartTotal, type CartItem, type CartPromoResumen } from '@/features/carta/cart';
import { crearPedidoExternoAction } from '../pedidoExternoActions';
import type { ModoPedido } from '../deliveryConfig';
import { validarCheckoutCliente } from '../checkoutValidation';

type Tipo = 'takeaway' | 'delivery';

function Campo({
  label,
  opcional,
  children,
}: {
  label: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-[0.2px] text-muted-foreground">
        {label}
        {opcional ? <span className="text-muted-foreground/70"> (opcional)</span> : null}
      </label>
      {children}
    </div>
  );
}

export function CheckoutExterno({
  open,
  onClose,
  tenantSlug,
  cartItems,
  modos,
  promoResumen = null,
  onPedidoCreado,
}: {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  cartItems: CartItem[];
  modos: ModoPedido[];
  promoResumen?: CartPromoResumen | null;
  onPedidoCreado: (sesionId: string, tipo: Tipo) => void;
}) {
  const opciones: Tipo[] = modos.length > 0 ? modos : ['takeaway', 'delivery'];
  const [tipo, setTipo] = useState<Tipo>(opciones[0]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opciones.includes(tipo)) setTipo(opciones[0]);
  }, [opciones, tipo]);

  const subtotal = getCartTotal(cartItems);
  const descuento = promoResumen && promoResumen.descuento > 0 ? promoResumen.descuento : 0;
  const total = Math.max(0, subtotal - descuento);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clienteErr = validarCheckoutCliente({
      nombre,
      telefono,
      tipo,
      direccion,
      itemsCount: cartItems.length,
    });
    if (clienteErr) {
      setError(clienteErr);
      return;
    }

    setEnviando(true);
    try {
      const res = await crearPedidoExternoAction(
        tenantSlug,
        tipo,
        {
          nombreContacto: nombre.trim(),
          telefono: telefono.trim(),
          direccion: tipo === 'delivery' ? direccion.trim() : undefined,
          referencia: tipo === 'delivery' ? referencia.trim() || undefined : undefined,
        },
        cartItems.map((i) => ({
          productoId: i.productoId,
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          modificadores: i.modificadores.map((m) => ({ id: m.id })),
        })),
      );
      if (res.success && res.sesionId) {
        onPedidoCreado(res.sesionId, tipo);
      } else {
        setError(res.message ?? 'No se pudo confirmar el pedido. Probá de nuevo.');
        setEnviando(false);
      }
    } catch {
      setError('Sin conexión o error de red. Revisá internet e intentá de nuevo.');
      setEnviando(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o && !enviando) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[92vh] flex-col gap-0 bg-background p-0 sm:max-w-md sm:rounded-t-2xl"
      >
        <SheetHeader className="border-b p-5 text-left">
          <SheetTitle className="text-lg">Finalizá tu pedido</SheetTitle>
          <SheetDescription>
            Confirmamos el pedido al local. Después podés pagar online o al recibir/retirar.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {opciones.length > 1 ? (
              <div className="grid grid-cols-2 gap-3">
                {opciones.includes('takeaway') && (
                  <button
                    type="button"
                    onClick={() => setTipo('takeaway')}
                    className={cn(
                      'rounded-lg border py-3 text-sm font-medium transition-colors',
                      tipo === 'takeaway'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Retiro en local
                  </button>
                )}
                {opciones.includes('delivery') && (
                  <button
                    type="button"
                    onClick={() => setTipo('delivery')}
                    className={cn(
                      'rounded-lg border py-3 text-sm font-medium transition-colors',
                      tipo === 'delivery'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Envío a domicilio
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted py-3 text-center text-sm font-medium text-foreground">
                {opciones[0] === 'delivery' ? 'Envío a domicilio' : 'Retiro en local'}
              </div>
            )}

            <Campo label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoComplete="name"
                className="h-12 rounded-lg text-base"
                placeholder="Tu nombre"
              />
            </Campo>

            <Campo label="Teléfono">
              <Input
                type="tel"
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                autoComplete="tel"
                className="h-12 rounded-lg text-base"
                placeholder="Ej: 11 2345 6789"
              />
            </Campo>

            {tipo === 'delivery' ? (
              <>
                <Campo label="Dirección">
                  <Input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    required
                    autoComplete="street-address"
                    className="h-12 rounded-lg text-base"
                    placeholder="Calle, número, piso/depto"
                  />
                </Campo>
                <Campo label="Referencia" opcional>
                  <Input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="h-12 rounded-lg text-base"
                    placeholder="Ej: timbre roto, golpear"
                  />
                </Campo>
                <p className="text-xs text-muted-foreground">
                  El costo de envío lo confirma el local si aplica.
                </p>
              </>
            ) : null}

            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t bg-muted/40 p-5">
            {descuento > 0 ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPeso(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-success-foreground">
                  <span>Descuento</span>
                  <span className="tabular-nums">−{formatPeso(descuento)}</span>
                </div>
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={enviando || cartItems.length === 0}
              size="lg"
              className="h-12 w-full justify-between text-base"
            >
              <span className="flex items-center gap-2">
                {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
                {enviando ? 'Confirmando…' : 'Confirmar pedido'}
              </span>
              <span className="tabular-nums">{formatPeso(total)}</span>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Al confirmar, el local recibe el pedido en cocina.
            </p>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
