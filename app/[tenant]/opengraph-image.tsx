import { ImageResponse } from 'next/og';
import { getTenantDetails } from '@/features/tenant/get-tenant';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';
import {
  GRADIENTE_MARCA,
  type ColorMarca,
} from '@/features/landing/landingConfig';

export const alt = 'Local en acomer';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

function truncar(texto: string, max: number): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * OG dinámico del local: gradiente según color de marca, nombre y descripción.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const rest = await getTenantDetails(tenant);

  const nombre = rest && !rest.deletedAt ? rest.nombre : 'Local no encontrado';
  let descripcion = 'Carta digital, pedidos online y reservas.';
  let direccion = '';
  let colorMarca: ColorMarca = 'terracota';

  if (rest && !rest.deletedAt) {
    const config = await obtenerLandingConfig(rest.id);
    colorMarca = config.colorMarca;
    if (config.descripcion.trim()) {
      descripcion = truncar(config.descripcion, 140);
    } else {
      descripcion = `Carta digital, pedidos y reservas en ${rest.nombre}.`;
    }
    direccion = config.direccion.trim();
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: GRADIENTE_MARCA[colorMarca],
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-60px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-140px',
            left: '-80px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        {/* Marca plataforma */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              letterSpacing: '-0.02em',
            }}
          >
            acomer
          </div>
        </div>

        {/* Identidad del local */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            zIndex: 1,
            maxWidth: '1000px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: nombre.length > 28 ? 64 : 80,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            {truncar(nombre, 48)}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.86)',
              lineHeight: 1.35,
              maxWidth: '900px',
            }}
          >
            {descripcion}
          </div>

          {direccion ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: 24,
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              {truncar(direccion, 70)}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1,
            color: 'rgba(255,255,255,0.72)',
            fontSize: 22,
          }}
        >
          <span>Carta</span>
          <span>·</span>
          <span>Pedidos</span>
          <span>·</span>
          <span>Reservas</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
