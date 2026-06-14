'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { canAccessSection, type RoleType } from '@/features/authorization/roles';
import { DollarSign } from 'lucide-react';

export function SidebarNav({ role }: { role: RoleType }) {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: '🏠 Dashboard', section: 'dashboard' },
    { href: '/admin/menu', label: '📋 Menú', section: 'menu' },
    { href: '/admin/staff', label: '👥 Empleados', section: 'staff' },
    { href: '/admin/mesas', label: '🪑 Mesas', section: 'tables' },
    { href: '/admin/reportes', label: '📊 Reportes', section: 'reports' },
    { href: '/admin/caja', label: '💳 Caja', section: 'cashier' },
    { href: '/admin/cobros', label: '💵 Cobros', section: 'cashier' },
    { href: '/admin/configuracion', label: '⚙️ Configuración', section: 'settings' },
  ] as const;

  return (
    <div className="space-y-2">
      {links.map((link) => {
        // El dashboard es accesible para todos los roles permitidos en /admin
        if (link.section !== 'dashboard' && !canAccessSection(role, link.section as any)) {
          return null;
        }

        const isActive = pathname === link.href || (link.href !== '/admin' && pathname?.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-4 py-2 rounded transition ${
              isActive
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'hover:bg-blue-50 text-gray-700 hover:text-blue-600'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
