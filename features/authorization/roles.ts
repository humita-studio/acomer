/**
 * Matriz de permisos por rol.
 * Define qué acciones pueden realizar los diferentes roles en cada sección.
 */

export type RoleType = 'owner' | 'admin' | 'cajero' | 'mozo' | 'cocina';

export interface RolePermissions {
  canManageMenu: boolean;      // CRUD categorías y productos
  canManagePrices: boolean;    // Modificar precios
  canManageStaff: boolean;     // Invitar empleados, asignar roles
  canManageTables: boolean;    // Crear/modificar mesas (alta, QR, eliminar)
  canTakeOrders: boolean;      // Cargar productos al ticket de una mesa desde el admin (mozo)
  canViewReports: boolean;     // Ver reportes y estadísticas
  canProcessPayments: boolean; // Procesar pagos
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
    canManageStaff: false, // El admin no puede crear otros admins
    canManageTables: true,
    canViewReports: true,
    canProcessPayments: true,
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
    canTakeOrders: false,
    canManageMenu: false,
    canManagePrices: false,
    canManageStaff: false,
    canManageTables: false,
    canViewReports: false,
    canProcessPayments: true,
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

/**
 * Verifica si un rol tiene acceso a una sección específica.
 */
export function canAccessSection(
  role: RoleType,
  section:
    | 'menu'
    | 'staff'
    | 'tables'
    | 'reports'
    | 'kitchen'
    | 'cashier'
    | 'settings'
    | 'reservas'
    | 'delivery'
): boolean {
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
    case 'kitchen':
      return permissions.canViewKanban;
    case 'cashier':
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
