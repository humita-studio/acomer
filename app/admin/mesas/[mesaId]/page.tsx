import { redirect } from 'next/navigation';

/**
 * El pedido de mesa se abre como modal sobre el plano (`?pedido=`).
 * Mantenemos la ruta por deep links / bookmarks antiguos.
 */
export default async function MesaPedidoPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = await params;
  redirect(`/admin/mesas?pedido=${encodeURIComponent(mesaId)}`);
}
