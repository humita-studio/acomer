'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import type { PlanoData } from '@/features/mesas/plano-data';
import { getPlanoDataAction } from '@/features/mesas/plano-actions';
import { PlanoCanvas } from './plano-canvas';
import { PlanoToolbar } from './plano-toolbar';
import { MesaLista } from './mesa-lista';
import { MesaPanel } from './mesa-panel';
import { ElementoPanel } from './elemento-panel';
import { OperacionPanel } from './operacion-panel';
import { usePlanoStore } from './plano-store';
import { usePlanoAcciones } from './use-plano-acciones';
import { type MesaPlano } from './plano-types';

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

  // Estado de UI del editor (Zustand). Los datos del plano viven en TanStack Query.
  const {
    modo,
    draft,
    ambienteActivoId,
    herramienta,
    seleccion,
    dirty,
    guardando,
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

  // Estado de servidor: el plano. `initialData` aprovecha el fetch del Server Component.
  const { data: planoData } = useQuery({
    queryKey: queryKeys.plano(tenantId),
    queryFn: getPlanoDataAction,
    initialData: { ambientes: initialAmbientes, mesas: initialMesas, elementos: initialElementos },
  });

  // Al desmontar el editor, vuelve al estado inicial (evita estado viejo al volver).
  useEffect(() => reset, [reset]);

  // Realtime: ocupación + alertas de mesa (llamar mozo / pedir cuenta)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);

    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, () => {
        // En edición se ignora para no pisar la copia de trabajo.
        if (usePlanoStore.getState().modo === 'ver') {
          queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
        }
      })
      .on('broadcast', { event: 'alerta_mesa' }, ({ payload }) => {
        pushAviso(`🔔 ${payload?.mesaIdentificador || 'Una mesa'} está llamando al mozo`);
      })
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        pushAviso('💵 Una mesa pidió la cuenta — revisá Cobros');
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, pushAviso]);

  // Fuente de datos según el modo
  const ambientes = editando && draft ? draft.ambientes : planoData.ambientes;
  const mesas = editando && draft ? draft.mesas : planoData.mesas;
  const elementos = editando && draft ? draft.elementos : planoData.elementos;

  // Ambiente activo válido (si se borró, cae al primero)
  const activeId = ambientes.some((a) => a.id === ambienteActivoId)
    ? ambienteActivoId
    : ambientes[0]?.id ?? '';

  const mesasAmbiente = useMemo(() => mesas.filter((m) => m.ambienteId === activeId), [mesas, activeId]);
  const elementosAmbiente = useMemo(
    () => elementos.filter((e) => e.ambienteId === activeId),
    [elementos, activeId]
  );

  const selMesa = seleccion?.tipo === 'mesa' ? mesas.find((m) => m.id === seleccion.id) ?? null : null;
  const selElemento =
    seleccion?.tipo === 'elemento' ? elementos.find((e) => e.id === seleccion.id) ?? null : null;
  const ambienteActivo = ambientes.find((a) => a.id === activeId) ?? null;

  // Acciones (CRUD optimista + operación), separadas en su propio hook.
  const acciones = usePlanoAcciones({ activeId, ambientes, mesas, elementos, draft, tenantId });

  // ---- Transiciones de modo / selección (estado de UI) ----
  const entrarEdicion = () => iniciarEdicion(planoData);

  const salirEdicion = () => {
    if (dirty && !confirm('Tenés cambios sin guardar. ¿Salir y descartarlos?')) return;
    terminarEdicion();
  };

  const toggleModo = () => (editando ? salirEdicion() : entrarEdicion());

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

  const mostrarPanel = editando ? !!(selMesa || selElemento) : !!selMesa;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* Alertas en vivo */}
      {avisos.length > 0 && (
        <div className="mb-4 space-y-2">
          {avisos.map((a) => (
            <div
              key={a.id}
              className="flex justify-between items-center bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <span>{a.texto}</span>
              <button
                onClick={() => removeAviso(a.id)}
                className="text-amber-500 hover:text-amber-700 ml-3"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <PlanoToolbar
        ambientes={ambientes}
        activeId={activeId}
        ambienteActivo={ambienteActivo}
        editando={editando}
        canManage={canManage}
        mostrarLista={mostrarLista}
        herramienta={herramienta}
        dirty={dirty}
        guardando={guardando}
        onCambiarAmbiente={cambiarAmbiente}
        onRenameAmbiente={acciones.handleRenameAmbiente}
        onAddAmbiente={acciones.handleAddAmbiente}
        onToggleMostrarLista={() => setMostrarLista((v) => !v)}
        onToggleModo={toggleModo}
        onSetHerramienta={setHerramienta}
        onAddMesa={acciones.handleAddMesa}
        onDeleteAmbiente={acciones.handleDeleteAmbiente}
        onGuardar={acciones.guardar}
      />

      {/* Área principal: lienzo + panel lateral */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
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
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
              No hay ambientes. {canManage && 'Creá uno para empezar.'}
            </div>
          )}
          {!editando && (
            <p className="mt-2 text-xs text-gray-400">
              Verde = libre · Naranja = ocupada · Tocá una mesa para ver su pedido, QR o liberarla.
            </p>
          )}
        </div>

        {/* Panel lateral */}
        {mostrarPanel && (
          <div className="lg:w-72 shrink-0 border border-gray-200 rounded-lg p-4 bg-gray-50 h-fit">
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
          </div>
        )}
      </div>

      {/* Lista de mesas (complemento, sin pestañas) */}
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
    </div>
  );
}
