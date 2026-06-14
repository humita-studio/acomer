import { redirect } from 'next/navigation';

// La gestión de mesas se unificó dentro del plano del local.
// El detalle de pedido sigue viviendo en /admin/mesas/[id].
export default function MesasPage() {
  redirect('/admin/plano');
}
