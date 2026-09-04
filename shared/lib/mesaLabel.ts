/**
 * Etiquetas de mesa para mostrar al usuario.
 *
 * Los identificadores los escribe el local: pueden ser "12", "A3" o venir ya
 * con la palabra ("Mesa 12", "Barra 2"). Componer `Mesa ${id}` a ciegas daba
 * "Mesa Mesa 12" en el QR, el ticket, la campana y las reservas. Un solo lugar
 * decide cómo se ve.
 */
const YA_TIENE_PREFIJO = /^(mesa|barra|box|sal[oó]n|terraza|patio|vereda|deck)\b/i;

export function etiquetaMesa(identificador: string | null | undefined): string {
  const id = (identificador ?? '').trim();
  if (!id) return 'Mesa';
  return YA_TIENE_PREFIJO.test(id) ? id : `Mesa ${id}`;
}

/** Origen legible de una sesión: la mesa, o mostrador / retiro / envío. */
export function etiquetaOrigenSesion(
  sesion:
    | { tipo?: string | null; mesa?: { identificador: string } | null }
    | null
    | undefined,
): string {
  if (!sesion) return 'Sin mesa';
  const id = sesion.mesa?.identificador?.trim();
  if (id) return etiquetaMesa(id);
  switch (sesion.tipo) {
    case 'takeaway':
      return 'Retiro en local';
    case 'delivery':
      return 'Delivery';
    case 'mostrador':
      return 'Mostrador';
    default:
      return 'Sin mesa';
  }
}
