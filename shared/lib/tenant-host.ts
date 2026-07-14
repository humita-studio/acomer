/**
 * Resuelve el slug del tenant a partir del Host y el dominio raíz.
 * Soporta Host con o sin puerto (p. ej. `nonna.localhost:3000` y `nonna.localhost`)
 * frente a mainDomain `localhost:3000` o `acomer.com.ar`.
 */
export function extractTenantSlug(
  hostname: string,
  mainDomain: string,
): string | null {
  const host = hostname.trim().toLowerCase();
  const main = mainDomain.trim().toLowerCase();
  if (!host || !main) return null;

  // Dominios de plataforma sin tenant.
  if (host.endsWith('.vercel.app')) return null;

  const stripPort = (h: string) => h.replace(/:\d+$/, '');
  const hostBare = stripPort(host);
  const mainBare = stripPort(main);

  const isApex = (h: string, m: string) =>
    h === m || h === `www.${m}` || h === `app.${m}`;

  if (isApex(host, main) || isApex(hostBare, mainBare)) return null;

  // Match con puerto: nonna.localhost:3000 + main localhost:3000
  if (host.endsWith(`.${main}`)) {
    const slug = host.slice(0, -(main.length + 1));
    return isValidSlug(slug) ? slug : null;
  }

  // Match sin puerto (o puerto sólo en uno de los dos): nonna.localhost + localhost
  if (hostBare.endsWith(`.${mainBare}`)) {
    const slug = hostBare.slice(0, -(mainBare.length + 1));
    return isValidSlug(slug) ? slug : null;
  }

  return null;
}

function isValidSlug(slug: string): boolean {
  return !!slug && /^[a-z0-9-]+$/.test(slug) && slug !== 'www' && slug !== 'app';
}
