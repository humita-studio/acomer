import Link from 'next/link';
import { CalendarOff, MessageCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';

type Variante = 'offline' | 'not_found' | 'error';

/** Pantallas de estado del flujo público /reservar. */
export function ReservaEstadoBox({
  variante,
  message,
  whatsapp,
}: {
  variante: Variante;
  message?: string;
  whatsapp?: string;
}) {
  const titulo =
    variante === 'offline'
      ? 'Reservas online no disponibles'
      : variante === 'not_found'
        ? 'Local no encontrado'
        : 'No pudimos cargar las reservas';

  const descripcion =
    message ||
    (variante === 'offline'
      ? 'Por el momento no tomamos reservas por la web. Escribinos o pasá por el local.'
      : variante === 'not_found'
        ? 'Ese subdominio no existe o el link es incorrecto.'
        : 'Revisá tu conexión e intentá de nuevo.');

  const Icon = variante === 'offline' ? CalendarOff : TriangleAlert;
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
          {waHref ? (
            <Button asChild size="lg" className="w-full">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                Escribir por WhatsApp
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{variante === 'not_found' ? 'Ir a acomer' : 'Volver al inicio'}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
