import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'acomer — El sistema operativo de tu restaurante';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '80px',
        }}
      >
        {/* Background decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            right: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          {/* Logo Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'white',
              color: '#09090b',
              padding: '12px 32px',
              borderRadius: '100px',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              marginBottom: '40px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            acomer
          </div>

          {/* Main Title */}
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              fontWeight: 700,
              color: 'white',
              textAlign: 'center',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: '32px',
              maxWidth: '900px',
            }}
          >
            El sistema operativo de tu restaurante
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: 'flex',
              fontSize: 36,
              fontWeight: 400,
              color: '#a1a1aa',
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            Gestión de restaurante: mesas, menú, pedidos y caja.
          </div>
        </div>

        {/* Bottom border/accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(90deg, #3f3f46 0%, #ffffff 50%, #3f3f46 100%)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
