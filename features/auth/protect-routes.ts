import { redirect } from 'next/navigation';
import { getCurrentSession } from './session';
import type { RoleType } from '@/features/authorization/roles';

/**
 * Protege una ruta requiriendo autenticación y opcionalmente un rol específico.
 * Si no está autenticado o no tiene el rol requerido, redirige a login.
 */
export async function requireAuth(allowedRoles?: RoleType[]) {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Hook para proteger rutas del admin.
 * Solo owner y admin pueden acceder.
 */
export async function requireAdminAccess() {
  return requireAuth(['owner', 'admin']);
}

/**
 * Hook para proteger rutas operativas (cocina, mozo).
 */
export async function requireOperationalAccess() {
  return requireAuth(['owner', 'admin', 'mozo', 'cocina', 'cajero']);
}
