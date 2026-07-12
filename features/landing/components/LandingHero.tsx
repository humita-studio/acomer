import Image from 'next/image';
import { Clock, MapPin } from 'lucide-react';
import { GRADIENTE_MARCA, type ColorMarca } from '../landingConfig';

/** Pill de estado (Abierto/Cerrado) sobre el gradiente del hero. */
function BadgeEstado({ abierto }: { abierto: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
      <span
        className={`size-2 rounded-full ${abierto ? 'bg-emerald-400' : 'bg-white/50'}`}
        aria-hidden
      />
      {abierto ? 'Abierto' : 'Cerrado'}
    </span>
  );
}

/**
 * Hero de la landing del local: foto de portada (si hay) o gradiente de marca,
 * con el nombre en Fraunces, la descripción y la fila de horario + dirección.
 */
export function LandingHero({
  nombre,
  descripcion,
  direccion,
  abierto,
  horarioTexto,
  colorMarca,
  imagenUrl,
}: {
  nombre: string;
  descripcion: string;
  direccion: string;
  abierto: boolean;
  horarioTexto: string;
  colorMarca: ColorMarca;
  /** URL optimizada de Cloudinary; vacío = solo gradiente de marca. */
  imagenUrl?: string;
}) {
  const hasImage = Boolean(imagenUrl);

  return (
    <header
      className="relative flex min-h-[58vh] flex-col justify-between overflow-hidden px-6 pb-7 pt-6 text-white"
      style={hasImage ? undefined : { background: GRADIENTE_MARCA[colorMarca] }}
    >
      {hasImage ? (
        <>
          <Image
            key={imagenUrl}
            src={imagenUrl!}
            alt=""
            fill
            priority
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
            // Cloudinary ya sirve f_auto/q_auto; evitamos doble optimización de Next.
            unoptimized
          />
          {/* Velos: legibilidad del texto + tinte de marca sutil */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-30 mix-blend-multiply"
            style={{ background: GRADIENTE_MARCA[colorMarca] }}
            aria-hidden
          />
        </>
      ) : null}

      {/* Barra superior: marca de la plataforma + estado */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-white/90">
          <span className="size-2 rounded-full bg-white/90" aria-hidden />
          acomer
        </span>
        <BadgeEstado abierto={abierto} />
      </div>

      {/* Bloque de identidad del local */}
      <div className="relative z-10 space-y-3">
        <h1 className="font-display text-5xl font-semibold leading-none tracking-tight">{nombre}</h1>
        {descripcion ? <p className="text-base text-white/85">{descripcion}</p> : null}

        {(horarioTexto || direccion) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-white/80">
            {horarioTexto ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {horarioTexto}
              </span>
            ) : null}
            {horarioTexto && direccion ? (
              <span className="text-white/40" aria-hidden>
                •
              </span>
            ) : null}
            {direccion ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {direccion}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
