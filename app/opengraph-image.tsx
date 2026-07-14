import { ImageResponse } from 'next/og';
import { GRADIENTE_MARCA } from '@/features/landing/landingConfig';

export const alt = 'acomer — Todo tu restaurante, en una sola plataforma';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

/**
 * OG de la plataforma (landing / rutas sin imagen propia).
 * Usa el gradiente terracota de la marca y el mismo copy del hero.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: GRADIENTE_MARCA.terracota,
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
        {/* Glow decorativo */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 68%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-160px',
            left: '-100px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        {/* Header: marca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 36,
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.03em',
            }}
          >
            acomer
          </div>
        </div>

        {/* Cuerpo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            zIndex: 1,
            maxWidth: '980px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '10px',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '999px',
              padding: '10px 20px',
              color: 'rgba(255,255,255,0.92)',
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            La plataforma para tu restaurante
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            Todo tu restaurante, en una sola plataforma.
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.82)',
              lineHeight: 1.35,
              maxWidth: '820px',
            }}
          >
            Comandas por QR, mesas, reservas, delivery y cobros — todo sincronizado en tiempo real.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 22,
          }}
        >
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>Carta digital</span>
            <span>·</span>
            <span>Pedidos</span>
            <span>·</span>
            <span>Reservas</span>
            <span>·</span>
            <span>Cobros</span>
          </div>
          <div style={{ display: 'flex', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            acomer.com.ar
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
