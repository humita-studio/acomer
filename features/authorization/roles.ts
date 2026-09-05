/**
 * Matriz de permisos por rol.
 * Define qué acciones pueden realizar los diferentes roles en cada sección.
 */

export type RoleType = 'owner' | 'admin' | 'cajero' | 'mozo' | 'cocina';

/** Cómo se llama cada rol de cara al usuario (sidebar, Empleados). */
export const ETIQUETA_ROL: Record<RoleType, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  cajero: 'Cajero',
  mozo: 'Mozo',
  cocina: 'Cocina',
};

export function etiquetaRol(role: string): string {
  return ETIQUETA_ROL[role as RoleType] ?? role;
}

export interface RolePermissions {
  canManageMenu: boolean;      // CRUD categorías y productos
  canManagePrices: boolean;    // Modificar precios
  canManageStaff: boolean;     // Invitar empleados, asignar roles
  canManageTables: boolean;    // Crear/modificar mesas (alta, QR, eliminar)
  canTakeOrders: boolean;      // Cargar productos al ticket de una mesa desde el admin (mozo)
  canViewReports: boolean;     // Ver reportes y estadísticas
  canProcessPayments: boolean; // Procesar pagos en la mesa
  canManageCashier: boolean;   // Abrir/cerrar caja registradora, retiros, arqueo
  canMarkDelivered: boolean;   // Marcar platos como entregados (mozo)
  canManageReservas: boolean;  // Gestionar reservas (agenda, confirmar, sentar)
  canManageDelivery: boolean;  // Gestionar pedidos online (takeaway/delivery)
  canViewKanban: boolean;      // Ver tablero de pedidos (cocina, mozo)
  canAcceptOrders: boolean;    // Aceptar/rechazar pedidos (cocina)
  canCallWaiter: boolean;      // Llamar al mozo desde la comanda B2C
  canAccessAdmin: boolean;     // Acceso al panel admin
  canManageSettings: boolean;  // Acceso a configuracion
}

export const ROLE_PERMISSIONS: Record<RoleType, RolePermissions> = {
  owner: {
    canTakeOrders: true,
    canManageMenu: true,
    canManagePrices: true,
    canManageStaff: true,
    canManageTables: true,
    canViewReports: true,
    canProcessPayments: true,
    canManageCashier: true,
    canMarkDelivered: true,
    canManageReservas: true,
    canManageDelivery: true,
    canViewKanban: true,
    canAcceptOrders: true,
    canCallWaiter: true,
    canAccessAdmin: true,
    canManageSettings: true,
  },
  admin: {
    canTakeOrders: true,
    canManageMenu: true,
    canManagePrices: true,
    // Puede invitar/activar staff; solo owner puede asignar rol admin (en invite-employee).
    canManageStaff: true,
    canManageTables: true,
    canViewReports: true,
    canProcessPayments: true,
    canManageCashier: true,
    canMarkDelivered: true,
    canManageReservas: true,
    canManageDelivery: true,
    canViewKanban: true,
    canAcceptOrders: true,
    canCallWaiter: true,
    canAccessAdmin: true,
    canManageSettings: true,
  },
  cajero: {
    canTakeOrders: true,
    canManageMenu: false,
    canManagePrices: false,
    canManageStaff: false,
    canManageTables: false,
    canViewReports: false,
    canProcessPayments: true,
    canManageCashier: true,
    canMarkDelivered: false,
    canManageReservas: false,
    canManageDelivery: false,
    canViewKanban: false,
    canAcceptOrders: false,
    canCallWaiter: false,
    canAccessAdmin: true, // Acceso al módulo de caja
    canManageSettings: false,
  },
  mozo: {
    canTakeOrders: true,
    canManageMenu: false,
    canManagePrices: false,
    canManageStaff: false,
    canManageTables: false,
    canViewReports: false,
    canProcessPayments: true, // Permitir al mozo procesar cobros en la mesa
    canManageCashier: false,  // Los mozos NO tienen acceso a abrir/cerrar caja ni retiros de efectivo
    canMarkDelivered: true,
    canManageReservas: true,
    canManageDelivery: true,
    canViewKanban: true,
    canAcceptOrders: false,
    canCallWaiter: false,
    canAccessAdmin: true, // Acceso a vistas operativas
    canManageSettings: false,
  },
  cocina: {
    canTakeOrders: false,
    canManageMenu: false,
    canManagePrices: false,
    canManageStaff: false,
    canManageTables: false,
    canViewReports: false,
    canProcessPayments: false,
    canManageCashier: false,
    canMarkDelivered: false,
    canManageReservas: false,
    canManageDelivery: false,
    canViewKanban: true,
    canAcceptOrders: true,
    canCallWaiter: false,
    canAccessAdmin: true, // Acceso solo al Kanban de cocina
    canManageSettings: false,
  },
};

/**
 * Obtiene los permisos de un rol.
 */
export function getRolePermissions(role: RoleType): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

/**
 * Verifica si un rol tiene un permiso específico.
 */
export function hasPermission(role: RoleType, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export type AdminSection =
  | 'menu'
  | 'staff'
  | 'tables'
  | 'reports'
  | 'kitchen'
  | 'cashier'
  | 'cobros'
  | 'settings'
  | 'reservas'
  | 'delivery'
  | 'resenas';

/**
 * Verifica si un rol tiene acceso a una sección específica.
 */
export function canAccessSection(role: RoleType, section: AdminSection): boolean {
  const permissions = getRolePermissions(role);

  switch (section) {
    case 'menu':
      return permissions.canManageMenu;
    case 'staff':
      return permissions.canManageStaff;
    case 'tables':
      // Mesas es la pantalla operativa del mozo: la ve quien gestione mesas o tome pedidos
      return permissions.canManageTables || permissions.canTakeOrders;
    case 'reports':
      return permissions.canViewReports;
    case 'resenas':
      return permissions.canViewReports || permissions.canManageSettings;
    case 'kitchen':
      return permissions.canViewKanban;
    case 'cashier':
      return permissions.canManageCashier;
    case 'cobros':
      return permissions.canProcessPayments;
    case 'settings':
      return permissions.canManageSettings;
    case 'reservas':
      return permissions.canManageReservas;
    case 'delivery':
      return permissions.canManageDelivery;
    default:
      return false;
  }
}

/** Ruta del panel (o prefijo) → sección que la protege. Orden: el primer prefijo que matchea gana. */
const SECCION_POR_RUTA: ReadonlyArray<readonly [prefijo: string, seccion: AdminSection]> = [
  ['/admin/menu', 'menu'],
  ['/admin/promociones', 'menu'],
  ['/admin/staff', 'staff'],
  ['/admin/mesas', 'tables'],
  ['/admin/reportes', 'reports'],
  ['/admin/resenas', 'resenas'],
  ['/admin/cocina', 'kitchen'],
  ['/admin/caja', 'cashier'],
  ['/admin/cobros', 'cobros'],
  ['/admin/configuracion', 'settings'],
  ['/admin/billing', 'settings'],
  ['/admin/reservas', 'reservas'],
  ['/admin/pedidos-online', 'delivery'],
];

/** Sección que protege una ruta del panel; null si la ruta no está mapeada (p. ej. /admin). */
export function seccionDeRutaAdmin(pathname: string): AdminSection | null {
  for (const [prefijo, seccion] of SECCION_POR_RUTA) {
    if (pathname === prefijo || pathname.startsWith(`${prefijo}/`)) return seccion;
  }
  return null;
}

/** Pantalla de entrada al panel según el rol (el dashboard es de dueño/admin). */
export function rutaInicialAdmin(role: RoleType): string {
  switch (role) {
    case 'cocina':
      return '/admin/cocina';
    case 'mozo':
      return '/admin/mesas';
    case 'cajero':
      return '/admin/caja';
    default:
      return '/admin';
  }
}
