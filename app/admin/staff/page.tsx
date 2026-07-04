'use client';

import {
  inviteEmployee,
  listEmployees,
  deactivateEmployee,
  activateEmployee,
} from '@/features/auth/invite-employee';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { RoleType } from '@/features/authorization/roles';

const ROLES: { value: RoleType; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'mozo', label: 'Mozo' },
  { value: 'cocina', label: 'Cocina' },
];

const ROL_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  cajero: 'Cajero',
  mozo: 'Mozo',
  cocina: 'Cocina',
};

export default function StaffPage() {
  const queryClient = useQueryClient();

  // Estado de UI local (no es estado de servidor).
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RoleType>('mozo');
  const [message, setMessage] = useState('');
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Estado de servidor: la lista de empleados.
  const {
    data: empleados = [],
    isLoading: loadingList,
    refetch,
  } = useQuery({
    queryKey: queryKeys.empleados(),
    queryFn: listEmployees,
  });

  const inviteMutation = useMutation({
    mutationFn: (vars: { email: string; rol: RoleType }) => inviteEmployee(vars),
    onSuccess: (result, variables) => {
      setMessage(result.message);
      if (result.success) {
        if (result.tempPassword) {
          setCredenciales({
            email: variables.email.trim().toLowerCase(),
            password: result.tempPassword,
          });
        }
        setEmail('');
        setRol('mozo');
        queryClient.invalidateQueries({ queryKey: queryKeys.empleados() });
      }
    },
    onError: () => {
      setMessage('Error al enviar la invitación');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (perfilId: string) => deactivateEmployee(perfilId),
    onSuccess: (result) => {
      setMessage(result.message);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.empleados() });
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: (perfilId: string) => activateEmployee(perfilId),
    onSuccess: (result) => {
      setMessage(result.message);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.empleados() });
      }
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setCredenciales(null);
    setCopiado(false);
    inviteMutation.mutate({ email, rol });
  };

  const copiarCredenciales = async () => {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El portapapeles puede no estar disponible (http o permisos); se ignora.
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Gestión de Empleados</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario de Invitación */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Invitar Empleado</h2>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email del Empleado
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="empleado@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Rol
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as RoleType)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary/90 disabled:bg-muted-foreground transition"
            >
              {inviteMutation.isPending ? 'Enviando...' : 'Enviar Invitación'}
            </button>

            {message && (
              <div
                className={`p-3 rounded-md ${
                  message.includes('Error') || message.includes('No tienes')
                    ? 'bg-destructive-subtle text-destructive'
                    : 'bg-success-subtle text-success-foreground'
                }`}
              >
                {message}
              </div>
            )}

            {credenciales && (
              <div className="p-4 rounded-md border border-warning/40 bg-warning-subtle">
                <p className="text-sm font-semibold text-warning-foreground mb-2">
                  Contraseña temporal (se muestra una sola vez)
                </p>
                <p className="text-xs text-warning-foreground mb-3">
                  Copiala y entregásela al empleado. No se vuelve a mostrar. Que la cambie al ingresar.
                </p>
                <dl className="text-sm space-y-1 mb-3">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">Email</dt>
                    <dd className="font-mono break-all">{credenciales.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">Contraseña</dt>
                    <dd className="font-mono font-bold tracking-wider">{credenciales.password}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={copiarCredenciales}
                  className="text-sm bg-warning text-white px-3 py-1.5 rounded-md hover:bg-warning transition"
                >
                  {copiado ? 'Copiado ✓' : 'Copiar credenciales'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Lista de Empleados */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Empleados</h2>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm text-primary hover:underline"
            >
              Actualizar
            </button>
          </div>

          {loadingList ? (
            <p className="text-muted-foreground text-sm">Cargando empleados...</p>
          ) : empleados.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no hay empleados cargados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {empleados.map((emp) => (
                <li key={emp.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{emp.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROL_LABELS[emp.rol] ?? emp.rol}
                      {!emp.activo && ' · Inactivo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        emp.activo
                          ? 'bg-success-subtle text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {emp.rol !== 'owner' &&
                      (emp.activo ? (
                        <button
                          type="button"
                          onClick={() => deactivateMutation.mutate(emp.id)}
                          disabled={deactivateMutation.isPending}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activateMutation.mutate(emp.id)}
                          disabled={activateMutation.isPending}
                          className="text-xs text-success-foreground hover:underline disabled:opacity-50"
                        >
                          Activar
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
