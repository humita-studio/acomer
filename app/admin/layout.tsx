import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { AppSidebar } from './app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';
import { Separator } from '@/shared/ui/separator';
import { ModeToggle } from '@/shared/ui/mode-toggle';
import type { RoleType } from '@/features/authorization/roles';

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
    <SidebarProvider>
      <AppSidebar
        role={session.role as RoleType}
        nombreRestaurante={session.nombreRestaurante}
        email={session.user.email}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="text-sm font-medium text-muted-foreground">
            {session.nombreRestaurante}
          </h1>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
