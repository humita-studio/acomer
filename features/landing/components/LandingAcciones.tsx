import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  MessageCircle,
  Phone,
  QrCode,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

// lucide-react ya no exporta íconos de marca (Instagram); lo dibujamos inline.
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
import { SOLIDO_MARCA, type AccionesLanding, type ColorMarca, type RedesLanding } from '../landingConfig';

type Accion = {
  key: keyof AccionesLanding;
  href: string;
  icon: LucideIcon;
  titulo: string;
  sub: string;
  chip: string; // clases del recuadro del icono (modo normal)
};

const ACCIONES: Accion[] = [
  {
    key: 'verCarta',
    href: 'carta',
    icon: UtensilsCrossed,
    titulo: 'Ver la carta',
    sub: 'Explorá el menú completo',
    chip: 'bg-accent text-accent-foreground',
  },
  {
    key: 'pedirOnline',
    href: 'pedir',
    icon: ShoppingBag,
    titulo: 'Pedir online',
    sub: 'Para llevar o delivery a tu casa',
    chip: 'bg-warning-subtle text-warning-foreground',
  },
  {
    key: 'reservar',
    href: 'reservar',
    icon: CalendarDays,
    titulo: 'Reservar una mesa',
    sub: 'Elegí día, horario y personas',
    chip: 'bg-success-subtle text-success-foreground',
  },
];

function TarjetaAccion({
  accion,
  destacada,
  colorMarca,
}: {
  accion: Accion;
  destacada: boolean;
  colorMarca: ColorMarca;
}) {
  const Icon = accion.icon;
  return (
    <Link
      // Links relativos al subdominio: el middleware (proxy.ts) inyecta el slug
      // del tenant a partir del host, así que la ruta NO lo incluye.
      href={`/${accion.href}`}
      className={
        destacada
          ? 'flex items-center gap-4 rounded-2xl p-4 text-white shadow-sm transition-transform active:scale-[0.99]'
          : 'flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40 active:scale-[0.99]'
      }
      style={destacada ? { backgroundColor: SOLIDO_MARCA[colorMarca] } : undefined}
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          destacada ? 'bg-white/15 text-white' : accion.chip
        }`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{accion.titulo}</span>
        <span className={`block text-sm ${destacada ? 'text-white/80' : 'text-muted-foreground'}`}>
          {accion.sub}
        </span>
      </span>
      <ChevronRight className={`size-5 shrink-0 ${destacada ? 'text-white/80' : 'text-muted-foreground'}`} aria-hidden />
    </Link>
  );
}

/** Link de red social, sólo si hay valor. */
function RedLink({
  icon: Icon,
  href,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-5" aria-hidden />
    </a>
  );
}

/**
 * Tarjetas de acción de la landing. La primera acción habilitada se muestra
 * "destacada" (rellena con el color de marca); el resto como tarjetas claras.
 * El bloque de QR es informativo (no enlaza). Abajo, las redes del local.
 */
export function LandingAcciones({
  acciones,
  colorMarca,
  redes,
}: {
  acciones: AccionesLanding;
  colorMarca: ColorMarca;
  redes: RedesLanding;
}) {
  const visibles = ACCIONES.filter((a) => acciones[a.key]);
  const tieneRedes = redes.whatsapp || redes.instagram || redes.telefono;

  return (
    <div className="mx-auto w-full max-w-md space-y-3 px-4 py-5">
      {visibles.map((accion, i) => (
        <TarjetaAccion key={accion.key} accion={accion} destacada={i === 0} colorMarca={colorMarca} />
      ))}

      {acciones.qr ? (
        <div className="flex items-center gap-4 rounded-2xl border border-dashed bg-muted/40 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <QrCode className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">¿Estás en el local?</span>
            <span className="block text-sm text-muted-foreground">
              Escaneá el QR de tu mesa para pedir
            </span>
          </span>
        </div>
      ) : null}

      {tieneRedes ? (
        <div className="flex items-center justify-center gap-3 pt-3">
          {redes.whatsapp ? (
            <RedLink
              icon={MessageCircle}
              href={`https://wa.me/${redes.whatsapp.replace(/\D/g, '')}`}
              label="WhatsApp"
            />
          ) : null}
          {redes.instagram ? (
            <RedLink
              icon={InstagramGlyph}
              href={`https://instagram.com/${redes.instagram.replace(/^@/, '')}`}
              label="Instagram"
            />
          ) : null}
          {redes.telefono ? (
            <RedLink icon={Phone} href={`tel:${redes.telefono.replace(/\s/g, '')}`} label="Teléfono" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
