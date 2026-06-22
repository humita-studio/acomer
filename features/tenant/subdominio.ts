// Validación y normalización del subdominio (= restaurantes.slug). Módulo plano
// (sin 'use server' ni `db`) para usarse tanto en la server action como en el
// form cliente (preview en vivo de cómo queda el subdominio).

/** Subdominios reservados por la plataforma (no se pueden usar como tenant). */
export const SUBDOMINIOS_RESERVADOS = new Set([
  'app',
  'www',
  'api',
  'admin',
  'mail',
  'smtp',
  'ftp',
  'cdn',
  'assets',
  'static',
  'acomer',
  'localhost',
  'dashboard',
  'panel',
  'soporte',
  'support',
  'help',
  'status',
  'blog',
]);

export const SUBDOMINIO_MIN = 3;
export const SUBDOMINIO_MAX = 63; // máximo de una etiqueta DNS

/**
 * Normaliza un texto a un subdominio válido: minúsculas, espacios→guion, sólo
 * `a-z 0-9 -`, sin guiones repetidos ni al inicio/fin.
 */
export function normalizarSubdominio(raw: string): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Devuelve un mensaje de error si el subdominio no es válido, o null si lo es. */
export function validarSubdominio(slug: string): string | null {
  if (slug.length < SUBDOMINIO_MIN) return `Debe tener al menos ${SUBDOMINIO_MIN} caracteres.`;
  if (slug.length > SUBDOMINIO_MAX) return `Es demasiado largo (máx. ${SUBDOMINIO_MAX}).`;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return 'Sólo minúsculas, números y guiones (sin empezar ni terminar en guion).';
  }
  if (SUBDOMINIOS_RESERVADOS.has(slug)) return 'Ese subdominio está reservado. Probá con otro.';
  return null;
}
