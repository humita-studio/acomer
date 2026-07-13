import Link from 'next/link';
import { Bike, MessageCircle, Store, TriangleAlert, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/shared/ui/button';

type Variante = 'offline' | 'error' | 'not_found';

/**
 * Pantallas de estado del flujo /pedir (cerrado, error, local no encontrado).
 * Opcionalmente ofrece WhatsApp y link a la carta pública.
 */
export function PedidosEstadoBox({
  variante,
  message,
  whatsapp,
  mostrarCarta = true,
}: {
  variante: Variante;
  message?: string;
  /** Solo dígitos con código de país, ej. 54911… */
  whatsapp?: string;
  mostrarCarta?: boolean;
}) {
  const titulo =
    variante === 'offline'
      ? 'Ahora no estamos tomando pedidos online'
      : variante === 'not_found'
        ? 'Local no encontrado'
        : 'No pudimos cargar tu pedido';

  const descripcion =
    message ||
    (variante === 'offline'
      ? 'Volvé más tarde o contactá al local. Mientras tanto podés mirar la carta.'
      : variante === 'not_found'
        ? 'Ese subdominio no existe o el link es incorrecto.'
        : 'Revisá el link o pedile al local que te reenvíe el seguimiento.');

  const Icon =
    variante === 'offline' ? Store : variante === 'not_found' ? Bike : TriangleAlert;

  const waHref =
    whatsapp && whatsapp.replace(/\D/g, '').length >= 8
      ? `https://wa.me/${whatsapp.replace(/\D/g, '')}`
      : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-full ${
            variante === 'offline'
              ? 'bg-muted text-muted-foreground'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <div className="flex flex-col gap-2">
          {mostrarCarta && variante !== 'not_found' ? (
            <Button asChild className="w-full" size="lg">
              <Link href="/carta">
                <UtensilsCrossed className="size-4" aria-hidden />
                Ver la carta
              </Link>
            </Button>
          ) : null}
          {waHref ? (
            <Button asChild variant="outline" className="w-full" size="lg">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                Escribir por WhatsApp
              </a>
            </Button>
          ) : null}
          {variante === 'not_found' ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Ir a acomer</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
