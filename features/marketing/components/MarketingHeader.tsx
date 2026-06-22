'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { BrandMark } from './BrandMark';
import { NAV_LINKS } from '../marketingContent';

/**
 * Header sticky de la landing del producto: marca, links de ancla y CTAs de
 * Ingresar / Crear mi local. En mobile, los links viven detrás de un menú
 * desplegable (la única pieza interactiva, por eso es Client Component).
 */
export function MarketingHeader() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="acomer — inicio" className="shrink-0">
          <BrandMark />
        </Link>

        <nav
          aria-label="Secciones"
          className="hidden items-center gap-8 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Crear mi local</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? <X /> : <Menu />}
        </Button>
      </div>

      {abierto ? (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav
            aria-label="Secciones"
            className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setAbierto(false)}
                className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild variant="outline" onClick={() => setAbierto(false)}>
                <Link href="/login">Ingresar</Link>
              </Button>
              <Button asChild onClick={() => setAbierto(false)}>
                <Link href="/register">Crear mi local</Link>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
