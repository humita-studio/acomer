'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Armchair,
  BarChart3,
  Banknote,
  Bike,
  CalendarDays,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Settings,
  TicketPercent,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { canAccessSection, type RoleType } from '@/features/authorization/roles';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/shared/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';

type Section = Parameters<typeof canAccessSection>[1] | 'dashboard';

type NavLink = {
  href: string;
  label: string;
  section: Section;
  icon: LucideIcon;
};

const LINKS: NavLink[] = [
  { href: '/admin', label: 'Dashboard', section: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/menu', label: 'Menú', section: 'menu', icon: UtensilsCrossed },
  { href: '/admin/promociones', label: 'Promociones', section: 'menu', icon: TicketPercent },
  { href: '/admin/staff', label: 'Empleados', section: 'staff', icon: Users },
  { href: '/admin/plano', label: 'Mesas', section: 'tables', icon: Armchair },
  { href: '/admin/reservas', label: 'Reservas', section: 'reservas', icon: CalendarDays },
  { href: '/admin/pedidos-online', label: 'Pedidos online', section: 'delivery', icon: Bike },
  { href: '/admin/reportes', label: 'Reportes', section: 'reports', icon: BarChart3 },
  { href: '/admin/caja', label: 'Caja', section: 'cashier', icon: Wallet },
  { href: '/admin/cobros', label: 'Cobros', section: 'cashier', icon: Banknote },
  { href: '/admin/configuracion', label: 'Configuración', section: 'settings', icon: Settings },
];

export function AppSidebar({
  role,
  nombreRestaurante,
  email,
}: {
  role: RoleType;
  nombreRestaurante: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const inicial = (nombreRestaurante?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {inicial}
          </div>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">{nombreRestaurante}</span>
            <span className="truncate text-xs text-muted-foreground capitalize">
              Panel de {role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map((link) => {
                if (
                  link.section !== 'dashboard' &&
                  !canAccessSection(role, link.section as Exclude<Section, 'dashboard'>)
                ) {
                  return null;
                }

                const isActive =
                  pathname === link.href ||
                  (link.href !== '/admin' && pathname?.startsWith(link.href));

                const Icon = link.icon;

                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton asChild isActive={!!isActive} tooltip={link.label}>
                      <Link href={link.href}>
                        <Icon />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md">{inicial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium capitalize">{role}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={4}
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="truncate text-sm font-medium capitalize">{role}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
