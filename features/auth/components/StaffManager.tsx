'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  activateEmployee,
  deactivateEmployee,
  inviteEmployee,
  listEmployees,
  resetEmployeePassword,
  updateEmployeeRole,
  type AssignableRole,
  type InviteMethod,
} from '@/features/auth/invite-employee';
import type { RoleType } from '@/features/authorization/roles';
import { queryKeys } from '@/shared/query/keys';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { cn } from '@/shared/lib/utils';

const ROLES_INVITABLES: { value: AssignableRole; label: string; hint: string }[] = [
  { value: 'mozo', label: 'Mozo', hint: 'Mesas, pedidos y cobros en salón' },
  { value: 'cocina', label: 'Cocina', hint: 'Tablero de pedidos de cocina' },
  { value: 'cajero', label: 'Cajero', hint: 'Caja y cobros' },
  { value: 'admin', label: 'Administrador', hint: 'Casi todo el panel (sin ser dueño)' },
];

const ROL_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  cajero: 'Cajero',
  mozo: 'Mozo',
  cocina: 'Cocina',
};

type Credenciales = { email: string; password: string; motivo: 'invite' | 'reset' };

function CredencialesBox({
  credenciales,
  onDismiss,
}: {
  credenciales: Credenciales;
  onDismiss: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(
        `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`,
      );
      setCopiado(true);
      toast.success('Credenciales copiadas');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Seleccioná el texto a mano.');
    }
  };

  return (
    <div className="rounded-lg border border-amber-300/80 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950/40">
      <p className="mb-1 text-sm font-semibold text-amber-950 dark:text-amber-100">
        Contraseña temporal (una sola vez)
      </p>
      <p className="mb-3 text-xs text-amber-900/80 dark:text-amber-200/80">
        {credenciales.motivo === 'reset'
          ? 'La contraseña anterior dejó de valer. Entregá esta al empleado: al ingresar deberá elegir una propia.'
          : 'Copiala y entregásela al empleado. Al primer ingreso el sistema le pide elegir una contraseña propia.'}
      </p>
      <dl className="mb-3 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">Email</dt>
          <dd className="font-mono break-all">{credenciales.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">Contraseña</dt>
          <dd className="font-mono font-semibold tracking-wider">{credenciales.password}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copiar}
          className="border-amber-400/60 bg-background/60"
        >
          {copiado ? (
            <>
              <Check />
              Copiado
            </>
          ) : (
            <>
              <Copy />
              Copiar credenciales
            </>
          )}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Ocultar
        </Button>
      </div>
    </div>
  );
}

export function StaffManager({
  sessionRole,
  sessionUserId,
}: {
  sessionRole: RoleType;
  sessionUserId: string;
}) {
  const queryClient = useQueryClient();
  const esOwner = sessionRole === 'owner';

  const rolesDisponibles = useMemo(
    () => (esOwner ? ROLES_INVITABLES : ROLES_INVITABLES.filter((r) => r.value !== 'admin')),
    [esOwner],
  );

  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<AssignableRole>('mozo');
  const [method, setMethod] = useState<InviteMethod>('temp');
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [resetTarget, setResetTarget] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const {
    data: empleados = [],
    isLoading: loadingList,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.empleados(),
    queryFn: listEmployees,
  });

  const invalidateStaff = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.empleados() });

  const inviteMutation = useMutation({
    mutationFn: (vars: { email: string; rol: AssignableRole; method: InviteMethod }) =>
      inviteEmployee(vars),
    onSuccess: (result, variables) => {
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.tempPassword) {
        setCredenciales({
          email: variables.email.trim().toLowerCase(),
          password: result.tempPassword,
          motivo: 'invite',
        });
      } else {
        setCredenciales(null);
      }
      setEmail('');
      setRol('mozo');
      invalidateStaff();
    },
    onError: () => {
      toast.error('No se pudo enviar la invitación. Probá de nuevo.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (perfilId: string) => deactivateEmployee(perfilId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        invalidateStaff();
      } else toast.error(result.message);
    },
    onError: () => toast.error('No se pudo desactivar al empleado'),
  });

  const activateMutation = useMutation({
    mutationFn: (perfilId: string) => activateEmployee(perfilId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        invalidateStaff();
      } else toast.error(result.message);
    },
    onError: () => toast.error('No se pudo activar al empleado'),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { perfilId: string; rol: AssignableRole }) =>
      updateEmployeeRole(vars.perfilId, vars.rol),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        invalidateStaff();
      } else toast.error(result.message);
    },
    onError: () => toast.error('No se pudo cambiar el rol'),
  });

  const resetMutation = useMutation({
    mutationFn: (perfilId: string) => resetEmployeePassword(perfilId),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.tempPassword && result.email) {
        setCredenciales({
          email: result.email,
          password: result.tempPassword,
          motivo: 'reset',
        });
      }
      setResetTarget(null);
    },
    onError: () => toast.error('No se pudo resetear la contraseña'),
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setCredenciales(null);
    inviteMutation.mutate({ email, rol, method });
  };

  const puedeResetear = (emp: {
    userId: string;
    rol: string;
    activo: boolean;
  }) => {
    if (emp.rol === 'owner') return false;
    if (emp.userId === sessionUserId) return false;
    if (!emp.activo) return false;
    if (emp.rol === 'admin' && !esOwner) return false;
    return true;
  };

  const activos = empleados.filter((e) => e.activo).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Empleados</h1>
        <p className="text-sm text-muted-foreground">
          Invitá al equipo con contraseña temporal o por email. Podés regenerar el acceso
          desde la lista cuando haga falta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4" />
              Invitar empleado
            </CardTitle>
            <CardDescription>
              Elegí cómo entregar el acceso. La contraseña temporal es la opción más
              confiable en el día a día del local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="empleado@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-rol">Rol</Label>
                <Select value={rol} onValueChange={(v) => setRol(v as AssignableRole)}>
                  <SelectTrigger id="staff-rol" className="w-full">
                    <SelectValue placeholder="Elegí un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesDisponibles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-2 text-muted-foreground">· {r.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cómo entregar el acceso</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMethod('temp')}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border p-3 text-left transition',
                      method === 'temp'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">Contraseña temporal</span>
                      <span className="block text-xs text-muted-foreground">
                        La ves acá una vez y se la pasás
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('email')}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border p-3 text-left transition',
                      method === 'email'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">Link por email</span>
                      <span className="block text-xs text-muted-foreground">
                        Supabase manda el invite (requiere SMTP)
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={inviteMutation.isPending || !email.trim()}
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {method === 'email' ? 'Enviando…' : 'Invitando…'}
                  </>
                ) : method === 'email' ? (
                  <>
                    <Mail />
                    Enviar invitación por email
                  </>
                ) : (
                  <>
                    <UserPlus />
                    Crear acceso
                  </>
                )}
              </Button>
            </form>

            {credenciales && (
              <CredencialesBox
                credenciales={credenciales}
                onDismiss={() => setCredenciales(null)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" />
                Equipo
              </CardTitle>
              <CardDescription>
                {loadingList
                  ? 'Cargando…'
                  : `${activos} activo${activos === 1 ? '' : 's'} · ${empleados.length} en total`}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualizar lista"
            >
              <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : empleados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay empleados cargados. Invitá al primero con el formulario.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {empleados.map((emp) => {
                  const esOwnerRow = emp.rol === 'owner';
                  return (
                    <li
                      key={emp.id}
                      className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium text-foreground">{emp.email}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {esOwnerRow ? (
                            <Badge variant="secondary">
                              {ROL_LABELS[emp.rol] ?? emp.rol}
                            </Badge>
                          ) : (
                            <Select
                              value={emp.rol}
                              disabled={roleMutation.isPending}
                              onValueChange={(v) =>
                                roleMutation.mutate({
                                  perfilId: emp.id,
                                  rol: v as AssignableRole,
                                })
                              }
                            >
                              <SelectTrigger size="sm" className="h-7 w-[10.5rem]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {rolesDisponibles.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                                {emp.rol === 'admin' && !esOwner && (
                                  <SelectItem value="admin">Administrador</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <Badge variant={emp.activo ? 'default' : 'outline'}>
                            {emp.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>

                      {!esOwnerRow && (
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {puedeResetear(emp) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setResetTarget({ id: emp.id, email: emp.email })
                              }
                              disabled={resetMutation.isPending}
                            >
                              <KeyRound />
                              Nueva clave
                            </Button>
                          )}
                          {emp.activo ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deactivateMutation.isPending}
                              onClick={() => deactivateMutation.mutate(emp.id)}
                            >
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={activateMutation.isPending}
                              onClick={() => activateMutation.mutate(emp.id)}
                            >
                              Activar
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open && !resetMutation.isPending) setResetTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva contraseña temporal</DialogTitle>
            <DialogDescription>
              Se invalida la clave actual de{' '}
              <span className="font-medium text-foreground">{resetTarget?.email}</span> y
              se genera una temporal. Al ingresar tendrá que elegir una propia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={resetMutation.isPending}
              onClick={() => setResetTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={resetMutation.isPending || !resetTarget}
              onClick={() => resetTarget && resetMutation.mutate(resetTarget.id)}
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <KeyRound />
                  Generar contraseña
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
