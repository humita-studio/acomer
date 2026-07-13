import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/features/marketing/components/BrandMark';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Términos y condiciones de uso de acomer.',
};

export default function TerminosPage() {
  const actualizado = '12 de julio de 2026';

  return (
    <main className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <BrandMark />
          </Link>
          <Link href="/register" className="text-sm font-medium text-primary hover:underline">
            Crear mi local
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Términos y condiciones
          </h1>
          <p className="text-sm text-muted-foreground">Última actualización: {actualizado}</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground">
          <p>
            Estos términos regulan el uso de la plataforma <strong>acomer</strong> (el
            “Servicio”), operada por humita / acomer en Argentina. Al crear una cuenta o
            usar el Servicio, aceptás estas condiciones.
          </p>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">1. Qué es acomer</h2>
            <p>
              acomer es un software multi-tenant para restaurantes: carta digital, comandas
              por QR, mesas, cocina, cobros (incluido Mercado Pago), pedidos online,
              reservas, reportes y panel de gestión. Cada local opera bajo su propio
              subdominio.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">2. Cuentas y responsabilidad</h2>
            <p>
              Sos responsable de la veracidad de los datos de tu local, del uso que hagan
              tus empleados con sus credenciales y de cumplir la normativa aplicable a tu
              actividad (incluyendo facturación y trato al consumidor). No debés compartir
              contraseñas ni intentar acceder a datos de otros locales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">3. Pagos de comensales</h2>
            <p>
              Los cobros con Mercado Pago se procesan con la cuenta que vos vinculás. acomer
              no es el adquirente de esos pagos: el dinero va a tu cuenta de Mercado Pago
              según las condiciones de ese proveedor. Efectivo y tarjeta en mesa se
              gestionan en tu local.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">4. Suscripción al Servicio</h2>
            <p>
              Los precios publicados en la web son de referencia. Durante la etapa piloto
              el plan y el cobro del SaaS se acuerdan con el equipo de acomer. Podemos
              modificar funcionalidades o precios con aviso razonable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">5. Disponibilidad y soporte</h2>
            <p>
              Buscamos alta disponibilidad, pero el Servicio se ofrece “tal cual”, sin
              garantía de funcionamiento ininterrumpido. El soporte se brinda por los
              canales que indiquemos (email / WhatsApp de contacto comercial).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">6. Datos y privacidad</h2>
            <p>
              El tratamiento de datos personales se detalla en la{' '}
              <Link href="/privacidad" className="font-medium text-primary hover:underline">
                Política de privacidad
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">7. Contacto</h2>
            <p>
              Consultas sobre estos términos: escribinos desde el flujo de registro o al
              canal de contacto que te hayamos asignado al dar de alta el local.
            </p>
          </section>
        </div>

        <p className="pt-4 text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            Volver al inicio
          </Link>
        </p>
      </article>
    </main>
  );
}
