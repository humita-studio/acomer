'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Armchair,
  BarChart3,
  Banknote,
  Bike,
  CalendarDays,
  ChefHat,
  ChevronsUpDown,
  LayoutGrid,
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
  SidebarGroupLabel,
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

type NavGroup = {
  label: string;
  links: NavLink[];
};

// Navegación agrupada según el rediseño: Principal / Operación / Gestión.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    links: [
      { href: '/admin', label: 'Dashboard', section: 'dashboard', icon: LayoutGrid },
      { href: '/admin/menu', label: 'Menú', section: 'menu', icon: UtensilsCrossed },
      { href: '/admin/mesas', label: 'Mesas', section: 'tables', icon: Armchair },
    ],
  },
  {
    label: 'Operación',
    links: [
      { href: '/admin/cocina', label: 'Cocina', section: 'kitchen', icon: ChefHat },
      { href: '/admin/caja', label: 'Caja', section: 'cashier', icon: Wallet },
      { href: '/admin/cobros', label: 'Cobros', section: 'cashier', icon: Banknote },
      { href: '/admin/pedidos-online', label: 'Pedidos online', section: 'delivery', icon: Bike },
      { href: '/admin/reservas', label: 'Reservas', section: 'reservas', icon: CalendarDays },
    ],
  },
  {
    label: 'Gestión',
    links: [
      { href: '/admin/reportes', label: 'Reportes', section: 'reports', icon: BarChart3 },
      { href: '/admin/staff', label: 'Empleados', section: 'staff', icon: Users },
      { href: '/admin/promociones', label: 'Promociones', section: 'menu', icon: TicketPercent },
      { href: '/admin/configuracion', label: 'Configuración', section: 'settings', icon: Settings },
    ],
  },
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

  const canSee = (link: NavLink) =>
    link.section === 'dashboard' ||
    canAccessSection(role, link.section as Exclude<Section, 'dashboard'>);

  const isLinkActive = (href: string) =>
    pathname === href || (href !== '/admin' && !!pathname?.startsWith(href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-lg font-semibold tracking-tight">
              {nombreRestaurante}
            </span>
            <span className="truncate text-xs text-muted-foreground capitalize">
              Panel de {role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const visibles = group.links.filter(canSee);
          if (visibles.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibles.map((link) => {
                    const Icon = link.icon;
                    return (
                      <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isLinkActive(link.href)}
                          tooltip={link.label}
                        >
                          <Link href={link.href} prefetch={true}>
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
          );
        })}
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
