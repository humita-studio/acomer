import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/features/marketing/components/BrandMark';
import { CONTACTO } from '@/features/marketing/marketingContent';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo acomer trata los datos personales.',
};

export default function PrivacidadPage() {
  const actualizado = '13 de julio de 2026';

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
            Política de privacidad
          </h1>
          <p className="text-sm text-muted-foreground">Última actualización: {actualizado}</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground">
          <p>
            En <strong>acomer</strong> tratamos datos personales para prestar el software de
            gestión de restaurantes. Esta política resume qué datos usamos y para qué.
          </p>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">1. Responsable</h2>
            <p>
              El responsable del tratamiento de los datos de las cuentas de locales y
              staff es el operador de acomer. Cada restaurante es responsable de los datos
              de sus comensales que cargue o reciba a través del Servicio (nombre,
              teléfono, dirección de delivery, pedidos, etc.).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">2. Datos que tratamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Dueños y staff:</strong> email, contraseña (hash vía Supabase Auth),
                rol, y datos del local (nombre, subdominio, menú, mesas, configuración).
              </li>
              <li>
                <strong>Comensales / pedidos online:</strong> nombre, teléfono, dirección
                (si hay delivery), contenido del pedido y datos de pago asociados a
                transacciones (estados, montos; el procesamiento de tarjetas lo hace
                Mercado Pago).
              </li>
              <li>
                <strong>Uso técnico:</strong> logs de errores, identificadores de sesión y
                datos necesarios para el funcionamiento multi-tenant y la seguridad.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">3. Finalidades</h2>
            <p>
              Prestar el Servicio, autenticar usuarios, procesar pedidos y cobros, enviar
              notificaciones operativas al staff, mejorar la estabilidad del producto y
              cumplir obligaciones legales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">4. Encargados y terceros</h2>
            <p>
              Usamos proveedores de infraestructura y autenticación (p. ej. Supabase /
              hosting), pagos (Mercado Pago) y, opcionalmente, almacenamiento de imágenes
              (Cloudinary). Cada uno trata datos según su propio rol y políticas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">5. Conservación</h2>
            <p>
              Conservamos los datos mientras la cuenta del local esté activa y el tiempo
              adicional que exija la ley o la resolución de disputas. Podés pedir la baja
              de tu cuenta de staff o del local contactándonos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">6. Derechos</h2>
            <p>
              Podés solicitar acceso, actualización o eliminación de tus datos personales
              de cuenta escribiendo a{' '}
              <a
                href={`mailto:${CONTACTO.email}`}
                className="font-medium text-primary hover:underline"
              >
                {CONTACTO.email}
              </a>
              . Los comensales deben dirigirse al restaurante correspondiente por los datos
              de su pedido.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">7. Seguridad</h2>
            <p>
              Aplicamos medidas razonables (HTTPS, aislamiento por tenant, roles, secretos
              de servidor). Ningún sistema es 100% infalible; si detectás un incidente,
              avisanos de inmediato.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">8. Cambios</h2>
            <p>
              Podemos actualizar esta política. La fecha de “última actualización” indica
              la versión vigente. El uso continuado del Servicio implica aceptación de los
              cambios materiales notificados en la web.
            </p>
          </section>
        </div>

        <p className="pt-4 text-sm text-muted-foreground">
          <Link href="/terminos" className="text-primary hover:underline">
            Términos y condiciones
          </Link>
          {' · '}
          <Link href="/" className="text-primary hover:underline">
            Inicio
          </Link>
        </p>
      </article>
    </main>
  );
}
