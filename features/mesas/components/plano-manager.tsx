'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Pencil, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import type { PlanoData } from '@/features/mesas/plano-data';
import { getPlanoDataAction } from '@/features/mesas/plano-actions';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { PlanoCanvas } from './plano-canvas';
import { PlanoToolbar } from './plano-toolbar';
import { MesaLista } from './mesa-lista';
import { MesaPanel } from './mesa-panel';
import { ElementoPanel } from './elemento-panel';
import { OperacionPanel } from './operacion-panel';
import { usePlanoStore, type SaveStatus } from './plano-store';
import { usePlanoAcciones } from './use-plano-acciones';
import { type MesaPlano, type Modo } from './plano-types';

export function PlanoManager({
  ambientes: initialAmbientes,
  mesas: initialMesas,
  elementos: initialElementos,
  origin,
  userRole,
  tenantId,
}: {
  ambientes: PlanoData['ambientes'];
  mesas: PlanoData['mesas'];
  elementos: PlanoData['elementos'];
  origin: string;
  userRole: string;
  tenantId: string;
}) {
  const canManage = hasPermission(userRole as RoleType, 'canManageTables');
  const canTakeOrders = hasPermission(userRole as RoleType, 'canTakeOrders');
  const queryClient = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);

  const {
    modo,
    draft,
    ambienteActivoId,
    herramienta,
    seleccion,
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

  useEffect(() => reset, [reset]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, () => {
        if (usePlanoStore.getState().modo === 'ver') {
          queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
        }
      })
      .on('broadcast', { event: 'alerta_mesa' }, ({ payload }) => {
        pushAviso(`Mesa ${payload?.mesaIdentificador || ''} llama al mozo`.trim());
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

  const mesasAmbiente = useMemo(() => mesas.filter((m) => m.ambienteId === activeId), [mesas, activeId]);
  const elementosAmbiente = useMemo(
    () => elementos.filter((e) => e.ambienteId === activeId),
    [elementos, activeId],
  );

  const stats = useMemo(() => {
    const ocupadas = mesas.filter((m) => m.ocupada).length;
    return { ocupadas, libres: mesas.length - ocupadas, total: mesas.length };
  }, [mesas]);

  const selMesa = seleccion?.tipo === 'mesa' ? mesas.find((m) => m.id === seleccion.id) ?? null : null;
  const selElemento =
    seleccion?.tipo === 'elemento' ? elementos.find((e) => e.id === seleccion.id) ?? null : null;
  const ambienteActivo = ambientes.find((a) => a.id === activeId) ?? null;

  const acciones = usePlanoAcciones({ activeId, ambientes, mesas, elementos, draft, tenantId });

  const setModoSeguro = async (next: Modo) => {
    if (next === modo) return;
    if (next === 'editar') {
      iniciarEdicion(planoData);
      return;
    }
    // Al salir de edición: flush del autosave (no pedimos descartar).
    if (dirty || guardando) {
      const ok = await acciones.flushSave();
      if (!ok) {
        const forzar = confirm(
          'No se pudieron guardar todos los cambios. ¿Salir igual y perder lo pendiente?',
        );
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
  const mostrarPanelOperacion = !editando && !!selMesa;

  return (
    <div className="space-y-6">
      {/* Page header — Figma Admin / Mesas */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {editando ? 'Plano de salón' : 'Mesas'}
          </h1>
          <p className="text-sm text-text-secondary">
            {editando
              ? 'Los cambios se guardan solos. Arrastrá, redimensioná y agregá mesas o paredes.'
              : `Plano de salón en vivo · ${stats.ocupadas} ocupadas · ${stats.libres} libres`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            saveStatus={saveStatus}
            stats={stats}
            onCambiarAmbiente={cambiarAmbiente}
            onRenameAmbiente={acciones.handleRenameAmbiente}
            onAddAmbiente={acciones.handleAddAmbiente}
            onToggleMostrarLista={() => setMostrarLista((v) => !v)}
            onSetModo={(m) => void setModoSeguro(m)}
            onSetHerramienta={setHerramienta}
            onAddMesa={() => void acciones.handleAddMesa()}
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
                onChangeMesa={acciones.updateMesa}
                onChangeElemento={acciones.updateElemento}
                onSelect={setSeleccion}
                onCreateElemento={acciones.handleCreateElemento}
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

        {/* Side column: avisos + panel de selección */}
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

          {(mostrarPanelEdicion || mostrarPanelOperacion) && (
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                {editando && selMesa && (
                  <MesaPanel
                    mesa={selMesa}
                    ambientes={ambientes}
                    onUpdate={(p) => acciones.updateMesa(selMesa.id, p)}
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
                {!editando && selMesa && (
                  <OperacionPanel
                    mesa={selMesa}
                    origin={origin}
                    canManage={canManage}
                    canTakeOrders={canTakeOrders}
                    liberando={liberandoId === selMesa.id}
                    abriendo={abriendoId === selMesa.id}
                    onLiberar={() => acciones.handleLiberar(selMesa)}
                    onAbrir={() => acciones.handleAbrir(selMesa)}
                    onDividir={() => acciones.handleDividir(selMesa)}
                    onUnir={() => acciones.handleUnir(selMesa)}
                    onClose={() => setSeleccion(null)}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {!editando && mostrarLista && (
        <MesaLista
          mesas={mesas}
          ambientes={ambientes}
          canManage={canManage}
          canTakeOrders={canTakeOrders}
          abriendoId={abriendoId}
          liberandoId={liberandoId}
          onSeleccionar={seleccionarMesa}
          onAbrir={acciones.handleAbrir}
          onLiberar={acciones.handleLiberar}
        />
      )}

      {/* Generar QR — pack de códigos por mesa */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">QR de mesas</DialogTitle>
          </DialogHeader>
          {mesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay mesas para generar QR.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {mesas.map((m) => {
                const url = `${origin}/mesa/${m.qrToken}`;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="text-sm font-semibold text-foreground">{m.identificador}</span>
                    <QRCodeSVG value={url} size={120} level="H" />
                    <button
                      type="button"
                      className="w-full truncate text-[10px] text-muted-foreground hover:text-primary"
                      title="Copiar URL"
                      onClick={() => navigator.clipboard?.writeText(url)}
                    >
                      Copiar link
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
