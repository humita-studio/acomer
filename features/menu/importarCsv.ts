/**
 * Parseo y validación de la plantilla CSV del menú (sin 'use server').
 * Columnas: nombre, descripcion, categoria, precio, disponible
 */

export type FilaMenuCsv = {
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  disponible: boolean;
  /** Número de línea en el archivo (1-indexed, incl. header). */
  linea: number;
};

export type ParseMenuCsvResult =
  | { ok: true; filas: FilaMenuCsv[] }
  | { ok: false; message: string; errores?: string[] };

const HEADERS_ESPERADOS = ['nombre', 'descripcion', 'categoria', 'precio', 'disponible'] as const;

/** Parsea una línea CSV simple (comillas opcionales, sin multilínea). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseDisponible(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'si' || v === 'sí' || v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'no' || v === 'false' || v === '0') return false;
  return true;
}

/**
 * Parsea el texto del CSV de la plantilla.
 * Tolera BOM UTF-8 y saltos CRLF.
 */
export function parseMenuCsv(text: string): ParseMenuCsvResult {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { ok: false, message: 'El archivo está vacío.' };
  }

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, message: 'El CSV necesita encabezado y al menos un producto.' };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const missing = HEADERS_ESPERADOS.filter((h) => !headerCells.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Faltan columnas: ${missing.join(', ')}. Usá la plantilla de ejemplo.`,
    };
  }

  const idx = {
    nombre: headerCells.indexOf('nombre'),
    descripcion: headerCells.indexOf('descripcion'),
    categoria: headerCells.indexOf('categoria'),
    precio: headerCells.indexOf('precio'),
    disponible: headerCells.indexOf('disponible'),
  };

  const filas: FilaMenuCsv[] = [];
  const errores: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const linea = i + 1;
    const nombre = (cells[idx.nombre] ?? '').trim();
    const categoria = (cells[idx.categoria] ?? '').trim();
    const precioRaw = (cells[idx.precio] ?? '').replace(/\s/g, '').replace(',', '.');
    const precio = Number(precioRaw);
    const descripcion = (cells[idx.descripcion] ?? '').trim();
    const disponible = parseDisponible(cells[idx.disponible] ?? 'si');

    if (!nombre) {
      errores.push(`Línea ${linea}: falta el nombre.`);
      continue;
    }
    if (!categoria) {
      errores.push(`Línea ${linea} (${nombre}): falta la categoría.`);
      continue;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      errores.push(`Línea ${linea} (${nombre}): precio inválido.`);
      continue;
    }

    filas.push({
      nombre: nombre.slice(0, 120),
      descripcion: descripcion.slice(0, 500),
      categoria: categoria.slice(0, 80),
      precio,
      disponible,
      linea,
    });
  }

  if (filas.length === 0) {
    return {
      ok: false,
      message: 'No se encontró ningún producto válido en el archivo.',
      errores: errores.slice(0, 8),
    };
  }

  if (errores.length > 0 && filas.length === 0) {
    return { ok: false, message: 'Todas las filas tienen errores.', errores: errores.slice(0, 8) };
  }

  return { ok: true, filas };
}
