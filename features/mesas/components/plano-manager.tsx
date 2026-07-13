'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Pencil, Printer, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { useConfirm } from '@/shared/hooks/use-confirm';
import type { PlanoData } from '@/features/mesas/plano-data';
import { getPlanoDataAction } from '@/features/mesas/plano-actions';
import {
  asignarMozoMesaAction,
  listMozosAction,
} from '@/features/mesas/mesas-actions';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { PlanoCanvas } from './plano-canvas';
import { PlanoToolbar } from './plano-toolbar';
import { MesaLista } from './mesa-lista';
import { MesaPanel } from './mesa-panel';
import { ElementoPanel } from './elemento-panel';
import { OperacionPanel } from './operacion-panel';
import { MesaPedidoDialog } from './mesa-detalle/mesa-pedido-dialog';
import { usePlanoStore, type SaveStatus } from './plano-store';
import { NUDGE_COARSE, NUDGE_FINE, usePlanoAcciones } from './use-plano-acciones';
import { type FiltroMozo, type MesaPlano, type Modo } from './plano-types';

function mesaPasaFiltroMozo(
  mesa: MesaPlano,
  filtro: FiltroMozo,
  currentUserId: string,
): boolean {
  if (filtro === 'todas') return true;
  if (filtro === 'mias') return mesa.mozoUserId === currentUserId;
  if (filtro === 'sin_asignar') return !mesa.mozoUserId;
  return mesa.mozoUserId === filtro;
}

export function PlanoManager({
  ambientes: initialAmbientes,
  mesas: initialMesas,
  elementos: initialElementos,
  origin,
  userRole,
  tenantId,
  currentUserId,
}: {
  ambientes: PlanoData['ambientes'];
  mesas: PlanoData['mesas'];
  elementos: PlanoData['elementos'];
  origin: string;
  userRole: string;
  tenantId: string;
  currentUserId: string;
}) {
  const canManage = hasPermission(userRole as RoleType, 'canManageTables');
  const canTakeOrders = hasPermission(userRole as RoleType, 'canTakeOrders');
  const esMozo = userRole === 'mozo';
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, confirmDialog } = useConfirm();
  const [qrOpen, setQrOpen] = useState(false);
  /**
   * Modal de pedido (reemplaza /admin/mesas/[mesaId]).
   * Puede venir de la UI o de deep link `?pedido=`.
   */
  const pedidoFromUrl = searchParams.get('pedido');
  const [pedidoLocalId, setPedidoLocalId] = useState<string | null>(null);
  const pedidoMesaId = pedidoLocalId ?? pedidoFromUrl;
  // Mozos ven por defecto solo sus mesas; admin/owner ven todas.
  const [filtroMozo, setFiltroMozo] = useState<FiltroMozo>(esMozo ? 'mias' : 'todas');

  const {
    modo,
    draft,
    ambienteActivoId,
    herramienta,
    seleccion,
    snapEnabled,
    layoutRevision,
    savedRevision,
    guardando,
    saveError,
    lastSavedAt,
    liberandoId,
    abriendoId,
    mostrarLista,
    avisos,
    setAmbienteActivoId,
    setHerramienta,
    setSeleccion,
    setSnapEnabled,
    setMostrarLista,
    pushAviso,
    removeAviso,
    iniciarEdicion,
    terminarEdicion,
    reset,
  } = usePlanoStore();

  const editando = modo === 'editar';
  const dirty = layoutRevision > savedRevision;
  const saveStatus: SaveStatus =
    saveError && !guardando
      ? 'error'
      : guardando
        ? 'saving'
        : dirty
          ? 'dirty'
          : lastSavedAt
            ? 'saved'
            : 'idle';

  const { data: planoData } = useQuery({
    queryKey: queryKeys.plano(tenantId),
    queryFn: getPlanoDataAction,
    initialData: { ambientes: initialAmbientes, mesas: initialMesas, elementos: initialElementos },
  });

  const { data: mozos = [] } = useQuery({
    queryKey: queryKeys.mozos(tenantId),
    queryFn: () => listMozosAction(),
    staleTime: 60 * 1000,
    enabled: canManage || canTakeOrders,
  });

  const mozoLabel = useMemo(() => {
    const map = new Map(mozos.map((m) => [m.userId, m.label]));
    return (userId: string | null | undefined) =>
      userId ? (map.get(userId) ?? 'Mozo') : null;
  }, [mozos]);

  const asignarMozoMutation = useMutation({
    mutationFn: async (vars: { mesaId: string; mozoUserId: string | null }) => {
      const res = await asignarMozoMesaAction(vars.mesaId, vars.mozoUserId);
      if (!res.success) throw new Error(res.message ?? 'No se pudo asignar');
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Mozo actualizado');
      void queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar el mozo');
    },
  });

  useEffect(() => reset, [reset]);

  const clearPedidoUrl = () => {
    if (!searchParams.get('pedido')) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('pedido');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const cerrarPedido = () => {
    setPedidoLocalId(null);
    clearPedidoUrl();
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, () => {
        if (usePlanoStore.getState().modo === 'ver') {
          queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
        }
      })
      .on('broadcast', { event: 'llamar_mozo' }, ({ payload }) => {
        const p = (payload ?? {}) as { mesaIdentificador?: string };
        const mesa = p.mesaIdentificador?.trim();
        pushAviso(mesa ? `Mesa ${mesa} llama al mozo` : 'Una mesa llama al mozo');
      })
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        pushAviso('Una mesa pidió la cuenta — revisá Cobros');
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, pushAviso]);

  const ambientes = editando && draft ? draft.ambientes : planoData.ambientes;
  const mesas = editando && draft ? draft.mesas : planoData.mesas;
  const elementos = editando && draft ? draft.elementos : planoData.elementos;

  const activeId = ambientes.some((a) => a.id === ambienteActivoId)
    ? ambienteActivoId
    : ambientes[0]?.id ?? '';

  // En edición no filtramos (hay que ver y mover todo). En operación sí.
  const mesasFiltradas = useMemo(() => {
    if (editando || filtroMozo === 'todas') return mesas;
    return mesas.filter((m) => mesaPasaFiltroMozo(m, filtroMozo, currentUserId));
  }, [mesas, editando, filtroMozo, currentUserId]);

  const mesasAmbiente = useMemo(
    () => mesasFiltradas.filter((m) => m.ambienteId === activeId),
    [mesasFiltradas, activeId],
  );
  const elementosAmbiente = useMemo(
    () => elementos.filter((e) => e.ambienteId === activeId),
    [elementos, activeId],
  );

  const stats = useMemo(() => {
    const base = editando ? mesas : mesasFiltradas;
    const ocupadas = base.filter((m) => m.ocupada).length;
    return { ocupadas, libres: base.length - ocupadas, total: base.length };
  }, [mesas, mesasFiltradas, editando]);

  const selMesa = seleccion?.tipo === 'mesa' ? mesas.find((m) => m.id === seleccion.id) ?? null : null;
  const selElemento =
    seleccion?.tipo === 'elemento' ? elementos.find((e) => e.id === seleccion.id) ?? null : null;
  const ambienteActivo = ambientes.find((a) => a.id === activeId) ?? null;

  const acciones = usePlanoAcciones({ activeId, ambientes, mesas, elementos, draft, tenantId });
  const accionesRef = useRef(acciones);
  useEffect(() => {
    accionesRef.current = acciones;
  }, [acciones]);

  // Atajos de teclado en modo edición (ignora si el foco está en un input).
  useEffect(() => {
    if (!editando) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) {
        return;
      }
      const a = accionesRef.current;
      const sel = usePlanoStore.getState().seleccion;
      const key = e.key.toLowerCase();
      if (key === 'v' || key === 'escape') {
        e.preventDefault();
        if (key === 'escape') setSeleccion(null);
        setHerramienta('seleccionar');
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        setHerramienta('mesa');
        return;
      }
      if (key === 'p') {
        e.preventDefault();
        setHerramienta('pared');
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        setHerramienta('barra');
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        a.handleDeleteSeleccion();
        return;
      }
      if (key === 'd' && (e.ctrlKey || e.metaKey) && sel?.tipo === 'mesa') {
        e.preventDefault();
        void a.handleDuplicateMesa(sel.id);
        return;
      }
      // R = +15° (Shift+R = −15°). Rotación libre con el handle ↻ del canvas.
      if (key === 'r' && sel) {
        e.preventDefault();
        a.handleRotateSeleccion(e.shiftKey ? -15 : 15);
        return;
      }
      const step = e.shiftKey ? NUDGE_COARSE : NUDGE_FINE;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        a.handleNudge(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        a.handleNudge(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        a.handleNudge(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        a.handleNudge(0, step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editando, setHerramienta, setSeleccion]);

  const setModoSeguro = async (next: Modo) => {
    if (next === modo) return;
    if (next === 'editar') {
      iniciarEdicion(planoData);
      // Primer armado: ir directo a colocar mesas con un click.
      if (planoData.mesas.length === 0) setHerramienta('mesa');
      return;
    }
    // Al salir de edición: flush del autosave (no pedimos descartar).
    if (dirty || guardando) {
      const ok = await acciones.flushSave();
      if (!ok) {
        const forzar = await confirm({
          title: 'No se pudieron guardar todos los cambios',
          description: '¿Salir igual y perder lo pendiente?',
          confirmLabel: 'Salir sin guardar',
          variant: 'destructive',
        });
        if (!forzar) return;
      }
    }
    // Alinea el cache del plano con lo último del draft antes de volver a Operar.
    queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    terminarEdicion();
  };

  const cambiarAmbiente = (id: string) => {
    if (id === activeId) return;
    setSeleccion(null);
    setAmbienteActivoId(id);
  };

  const seleccionarMesa = (mesa: MesaPlano) => {
    if (mesa.ambienteId && mesa.ambienteId !== activeId) setAmbienteActivoId(mesa.ambienteId);
    setSeleccion({ tipo: 'mesa', id: mesa.id });
    setMostrarLista(false);
  };

  const mostrarPanelEdicion = editando && !!(selMesa || selElemento);
  // No mostrar el sheet debajo del modal de pedido (doble overlay).
  const sheetOperacionOpen = !editando && !!selMesa && !pedidoMesaId;

  const abrirPedido = (mesa: MesaPlano) => {
    setPedidoLocalId(mesa.id);
  };

  const handleAbrirYPedido = async (mesa: MesaPlano) => {
    const ok = await acciones.handleAbrir(mesa);
    if (ok) setPedidoLocalId(mesa.id);
  };

  return (
    <div className="space-y-6">
      {acciones.dialogs}
      {confirmDialog}
      <MesaPedidoDialog
        mesaId={pedidoMesaId}
        tenantId={tenantId}
        open={!!pedidoMesaId}
        onOpenChange={(open) => {
          if (!open) cerrarPedido();
        }}
      />
      {/* Page header — Figma Admin / Mesas */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {editando ? 'Plano de salón' : 'Mesas'}
          </h1>
          <p className="text-sm text-text-secondary">
            {editando
              ? 'Autosave activo. Usá la herramienta Mesa y clickeá donde quieras colocarla.'
              : `Plano de salón en vivo · ${stats.ocupadas} ocupadas · ${stats.libres} libres`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editando && (canManage || canTakeOrders) && (
            <select
              value={filtroMozo}
              onChange={(e) => setFiltroMozo(e.target.value as FiltroMozo)}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              aria-label="Filtrar mesas por mozo"
            >
              <option value="todas">Todas las mesas</option>
              {(esMozo || canTakeOrders) && <option value="mias">Mis mesas</option>}
              <option value="sin_asignar">Sin asignar</option>
              {canManage &&
                mozos.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
            </select>
          )}
          <Button type="button" variant="outline" size="lg" onClick={() => setQrOpen(true)}>
            <QrCode />
            Generar QR
          </Button>
          {canManage && !editando && (
            <Button type="button" size="lg" onClick={() => void setModoSeguro('editar')}>
              <Pencil />
              Editar plano
            </Button>
          )}
          {canManage && editando && (
            <Button type="button" variant="secondary" size="lg" onClick={() => void setModoSeguro('ver')}>
              Listo
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Canvas */}
        <Card className="min-w-0 flex-1 gap-0 overflow-hidden py-0 shadow-sm">
          <PlanoToolbar
            ambientes={ambientes}
            activeId={activeId}
            ambienteActivo={ambienteActivo}
            modo={modo}
            canManage={canManage}
            mostrarLista={mostrarLista}
            herramienta={herramienta}
            snapEnabled={snapEnabled}
            saveStatus={saveStatus}
            stats={stats}
            onCambiarAmbiente={cambiarAmbiente}
            onRenameAmbiente={acciones.handleRenameAmbiente}
            onAddAmbiente={acciones.handleAddAmbiente}
            onToggleMostrarLista={() => setMostrarLista((v) => !v)}
            onSetModo={(m) => void setModoSeguro(m)}
            onSetHerramienta={setHerramienta}
            onToggleSnap={() => setSnapEnabled((v) => !v)}
            onAddMesaRapida={() => void acciones.handleAddMesa()}
            onDeleteAmbiente={(a) => void acciones.handleDeleteAmbiente(a)}
            onRetrySave={() => void acciones.guardar({ revalidate: false })}
          />
          <CardContent className="p-3 sm:p-4">
            {activeId ? (
              <PlanoCanvas
                mesas={mesasAmbiente}
                elementos={elementosAmbiente}
                modo={modo}
                herramienta={herramienta}
                seleccion={seleccion}
                snapEnabled={snapEnabled}
                mozoLabel={mozoLabel}
                onChangeMesa={acciones.updateMesa}
                onChangeElemento={acciones.updateElemento}
                onSelect={setSeleccion}
                onCreateElemento={acciones.handleCreateElemento}
                onPlaceMesa={(pos) => void acciones.handleAddMesa({ ...pos, silent: true })}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border-strong py-16 text-center text-sm text-muted-foreground">
                No hay ambientes. {canManage && 'Creá uno para empezar.'}
              </div>
            )}
            {!editando && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tocá una mesa para ver el pedido, el QR o liberarla.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Side column: avisos (siempre) + panel de edición (solo modo editar) */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="size-2 rounded-full bg-primary" />
                Avisos en vivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {avisos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin avisos por ahora.</p>
              ) : (
                avisos.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
                  >
                    <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 text-foreground">{a.texto}</span>
                    <button
                      type="button"
                      onClick={() => removeAviso(a.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Descartar aviso"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {mostrarPanelEdicion && (
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                {editando && selMesa && (
                  <MesaPanel
                    mesa={selMesa}
                    ambientes={ambientes}
                    onUpdate={(p) => acciones.updateMesa(selMesa.id, p)}
                    onRename={(nombre) => void acciones.handleRenameMesa(selMesa.id, nombre)}
                    onDuplicate={() => void acciones.handleDuplicateMesa(selMesa.id)}
                    onDelete={() => acciones.handleDeleteMesa(selMesa.id)}
                  />
                )}
                {editando && selElemento && (
                  <ElementoPanel
                    elemento={selElemento}
                    onUpdate={(p) => acciones.updateElemento(selElemento.id, p)}
                    onDelete={() => acciones.handleDeleteElemento(selElemento.id)}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Detalle de mesa en operación: drawer (no apila bajo avisos ni achica el plano) */}
      <Sheet
        open={sheetOperacionOpen}
        onOpenChange={(open) => {
          if (!open) setSeleccion(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md"
          showCloseButton={false}
        >
          {selMesa && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{selMesa.identificador}</SheetTitle>
                <SheetDescription>Acciones y QR de la mesa seleccionada</SheetDescription>
              </SheetHeader>
              <div className="p-5">
                <OperacionPanel
                  mesa={selMesa}
                  origin={origin}
                  canManage={canManage}
                  canTakeOrders={canTakeOrders}
                  liberando={liberandoId === selMesa.id}
                  abriendo={abriendoId === selMesa.id}
                  asignando={
                    asignarMozoMutation.isPending &&
                    asignarMozoMutation.variables?.mesaId === selMesa.id
                  }
                  mozos={mozos}
                  onLiberar={() => acciones.handleLiberar(selMesa)}
                  onAbrir={() => void handleAbrirYPedido(selMesa)}
                  onVerPedido={() => abrirPedido(selMesa)}
                  onDividir={() => acciones.handleDividir(selMesa)}
                  onUnir={() => acciones.handleUnir(selMesa)}
                  onAsignarMozo={(mozoUserId) =>
                    asignarMozoMutation.mutate({ mesaId: selMesa.id, mozoUserId })
                  }
                  onClose={() => setSeleccion(null)}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {!editando && mostrarLista && (
        <MesaLista
          mesas={mesasFiltradas}
          ambientes={ambientes}
          canManage={canManage}
          canTakeOrders={canTakeOrders}
          abriendoId={abriendoId}
          liberandoId={liberandoId}
          mozoLabel={mozoLabel}
          onSeleccionar={seleccionarMesa}
          onAbrir={(m) => void handleAbrirYPedido(m)}
          onVerPedido={abrirPedido}
          onLiberar={acciones.handleLiberar}
        />
      )}

      {/* Generar QR — pack de códigos por mesa + impresión */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl print:max-h-none print:max-w-none print:overflow-visible print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-display text-xl">QR de mesas</DialogTitle>
          </DialogHeader>
          {mesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay mesas para generar QR.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <p className="text-sm text-muted-foreground">
                  {mesas.length} mesa{mesas.length === 1 ? '' : 's'} · imprimí y poné un QR en cada una
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" aria-hidden />
                  Imprimir todos
                </Button>
              </div>
              <div
                id="qr-print-pack"
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-6"
              >
                {mesas.map((m) => {
                  const url = `${origin}/mesa/${m.qrToken}`;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 print:break-inside-avoid print:border-border"
                    >
                      <span className="text-sm font-semibold text-foreground">
                        Mesa {m.identificador}
                      </span>
                      <QRCodeSVG value={url} size={120} level="H" />
                      <button
                        type="button"
                        className="w-full truncate text-[10px] text-muted-foreground hover:text-primary print:hidden"
                        title="Copiar URL"
                        onClick={() => navigator.clipboard?.writeText(url)}
                      >
                        Copiar link
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
