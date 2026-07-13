import Link from 'next/link';
import { BrandMark } from './BrandMark';
import { CONTACTO, NAV_LINKS } from '../marketingContent';

/**
 * Footer de la landing: marca + tagline, columnas de links (producto y cuenta) y
 * la línea legal con el año actual.
 */
export function MarketingFooter() {
  const anio = new Date().getFullYear();
  const waHref = CONTACTO.whatsapp
    ? `https://wa.me/${CONTACTO.whatsapp}`
    : null;

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <BrandMark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              El sistema operativo de tu restaurante. Comandas, mesas, reservas y
              cobros en un solo lugar.
            </p>
          </div>

          <nav aria-label="Producto">
            <h2 className="text-sm font-semibold text-foreground">Producto</h2>
            <ul className="mt-3 space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Cuenta y contacto">
            <h2 className="text-sm font-semibold text-foreground">Cuenta</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/register"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Crear mi local
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ingresar
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACTO.email}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {CONTACTO.email}
                </a>
              </li>
              {waHref ? (
                <li>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {anio} acomer. Hecho en Argentina.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terminos" className="hover:text-foreground">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
