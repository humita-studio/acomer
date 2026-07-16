import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentSession } from '@/features/auth/session';
import { getPlatformSession } from '@/features/platform/session';
import { isPlatformAdminEmail } from '@/features/platform/platformAllowlist';
import { getBillingSnapshotAction } from '@/features/billing/billingActions';
import { BillingBanner } from '@/features/billing/components/BillingBanner';
import { AppSidebar } from './app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';
import { Separator } from '@/shared/ui/separator';
import { ModeToggle } from '@/shared/ui/mode-toggle';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { NuevaVentaButton } from '@/features/venta-mostrador/components/NuevaVentaButton';
import { StaffNotifications } from '@/features/notificaciones/components/StaffNotifications';
import { AdminSearch } from '@/features/busqueda/components/AdminSearch';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    // Operador de acomer sin perfil de local: mandar al panel de plataforma.
    const platform = await getPlatformSession();
    if (platform) {
      redirect('/platform');
    }
    redirect('/login');
  }

  const allowedRoles = ['owner', 'admin', 'cajero', 'mozo', 'cocina'];
  if (!allowedRoles.includes(session.role)) {
    redirect('/unauthorized');
  }

  const billing = await getBillingSnapshotAction();
  const pathname = (await headers()).get('x-pathname') || '';
  const enBilling = pathname.startsWith('/admin/billing');

  // Plan vencido: solo dueño/admin pueden ir a facturación; el resto ve unauthorized.
  if (billing && !billing.accessOk && !enBilling) {
    if (session.role === 'owner' || session.role === 'admin') {
      redirect('/admin/billing');
    }
    redirect('/unauthorized');
  }

  const showPlatformLink = isPlatformAdminEmail(session.user.email);

  return (
    <SidebarProvider>
      <AppSidebar
        role={session.role as RoleType}
        nombreRestaurante={session.nombreRestaurante}
        email={session.user.email}
        showPlatformLink={showPlatformLink}
      />
      <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
        {billing && (billing.showPayBanner || !billing.accessOk) ? (
          <BillingBanner billing={billing} />
        ) : null}
        <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="text-sm font-medium text-muted-foreground md:hidden">
            {session.nombreRestaurante}
          </h1>

          <AdminSearch />

          <StaffNotifications
            tenantId={session.restauranteId}
            alertarCajaCerrada={hasPermission(
              session.role as RoleType,
              'canProcessPayments',
            )}
          />

          {hasPermission(session.role as RoleType, 'canProcessPayments') &&
            billing?.accessOk !== false && (
              <NuevaVentaButton tenantId={session.restauranteId} />
            )}

          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
