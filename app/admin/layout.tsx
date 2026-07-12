import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/features/auth/session';
import { AppSidebar } from './app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';
import { Separator } from '@/shared/ui/separator';
import { ModeToggle } from '@/shared/ui/mode-toggle';
import { Input } from '@/shared/ui/input';
import { Search } from 'lucide-react';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { NuevaVentaButton } from '@/features/venta-mostrador/components/NuevaVentaButton';
import { StaffNotifications } from '@/features/notificaciones/components/StaffNotifications';

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
            <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
                <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 !h-4" />
                    <h1 className="text-sm font-medium text-muted-foreground md:hidden">
                        {session.nombreRestaurante}
                    </h1>

                    {/* Buscador */}
                    <div className="relative hidden w-full max-w-xs sm:block">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Buscar pedidos, mesas…" className="pl-9" aria-label="Buscar" />
                    </div>

                    <StaffNotifications tenantId={session.restauranteId} />

                    {/* Nueva venta, a la derecha del buscador */}
                    {hasPermission(session.role as RoleType, 'canProcessPayments') && (
                        <NuevaVentaButton tenantId={session.restauranteId} />
                    )}

                    {/* Theme toggle, en el extremo derecho */}
                    <div className="ml-auto">
                        <ModeToggle />
                    </div>
                </header>
                <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
