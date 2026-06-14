import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { LogoutButton } from './logout-button';
import { SidebarNav } from './sidebar-nav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Proteger la ruta: requiere autenticación
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  // Solo owner, admin, cajero, mozo y cocina pueden acceder al admin
  const allowedRoles = ['owner', 'admin', 'cajero', 'mozo', 'cocina'];
  if (!allowedRoles.includes(session.role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md relative">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-800">{session.nombreRestaurante}</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">Panel de {session.role}</p>
        </div>

        <nav className="p-4">
          <SidebarNav role={session.role as any} />
        </nav>

        {/* User Menu */}
        <div className="absolute bottom-0 w-64 p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600 truncate">{session.user.email}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
