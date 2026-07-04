'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useConfirm, usePrompt } from '@/shared/ui/confirm-dialog';
import {
  crearAmbiente,
  renombrarAmbiente,
  eliminarAmbiente,
  crearMesaEnPlano,
  eliminarMesaPlano,
  crearElementoPlano,
  eliminarElementoPlano,
  guardarLayoutAction,
  dividirMesaAction,
  unirMesaAction,
} from '@/features/mesas/plano-actions';
import { liberarMesaAction, abrirMesaAction } from '@/features/mesas/mesas-actions';
import { queryKeys } from '@/shared/query/keys';
import { usePlanoStore, type PlanoDraft } from './plano-store';
import {
  type AmbienteUI,
  type ElementoPlanoUI,
  type Herramienta,
  type MesaPlano,
} from './plano-types';

/**
 * Acciones del editor de plano. Las mutaciones de la copia de trabajo son
 * optimistas (la UI cambia al instante y reconcilia/revierte con el server).
 * Recibe los datos derivados desde el manager y toma del store solo los setters.
 */
export function usePlanoAcciones({
  activeId,
  ambientes,
  mesas,
  elementos,
  draft,
  tenantId,
}: {
  activeId: string;
  ambientes: AmbienteUI[];
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
  draft: PlanoDraft | null;
  tenantId: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { prompt: pedir, dialog: promptDialog } = usePrompt();
  const patchDraft = usePlanoStore((s) => s.patchDraft);
  const setSeleccion = usePlanoStore((s) => s.setSeleccion);
  const setAmbienteActivoId = usePlanoStore((s) => s.setAmbienteActivoId);
  const setLiberandoId = usePlanoStore((s) => s.setLiberandoId);
  const setAbriendoId = usePlanoStore((s) => s.setAbriendoId);
  const setGuardando = usePlanoStore((s) => s.setGuardando);
  const setDirty = usePlanoStore((s) => s.setDirty);

  // ---- Mutaciones de la copia de trabajo ----
  const updateMesa = (id: string, partial: Partial<MesaPlano>) =>
    patchDraft((d) => ({ ...d, mesas: d.mesas.map((m) => (m.id === id ? { ...m, ...partial } : m)) }));

  const updateElemento = (id: string, partial: Partial<ElementoPlanoUI>) =>
    patchDraft((d) => ({ ...d, elementos: d.elementos.map((e) => (e.id === id ? { ...e, ...partial } : e)) }));

  // ---- Acciones optimistas: la UI se actualiza al instante y reconcilia con
  // el id real cuando responde el server (o revierte si falla). ----
  const handleAddMesa = async () => {
    const nombre = (await pedir({ titulo: 'Nueva mesa', label: 'Identificador', placeholder: 'ej: Mesa 5' }))?.trim();
    if (!nombre) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimista: MesaPlano = {
      id: tempId,
      identificador: nombre,
      qrToken: '',
      parentMesaId: null,
      ambienteId: activeId,
      posX: 1,
      posY: 1,
      ancho: 2,
      alto: 2,
      forma: 'cuadrada',
      capacidad: 4,
      rotacion: 0,
      ocupada: false,
    };
    patchDraft((d) => ({ ...d, mesas: [...d.mesas, optimista] }), false);
    setSeleccion({ tipo: 'mesa', id: tempId });

    const res = await crearMesaEnPlano(activeId, nombre);
    if (res.success && res.mesa) {
      const real = res.mesa as MesaPlano;
      patchDraft((d) => ({ ...d, mesas: d.mesas.map((m) => (m.id === tempId ? real : m)) }), false);
      setSeleccion((s) => (s?.tipo === 'mesa' && s.id === tempId ? { tipo: 'mesa', id: real.id } : s));
    } else {
      patchDraft((d) => ({ ...d, mesas: d.mesas.filter((m) => m.id !== tempId) }), false);
      setSeleccion((s) => (s?.tipo === 'mesa' && s.id === tempId ? null : s));
      toast.error(res.message || 'No se pudo crear la mesa');
    }
  };

  const handleAddAmbiente = async () => {
    const nombre = (await pedir({ titulo: 'Nuevo ambiente', label: 'Nombre', placeholder: 'ej: Patio' }))?.trim();
    if (!nombre) return;
    const res = await crearAmbiente(nombre);
    if (res.success && res.ambiente) {
      const amb = res.ambiente as AmbienteUI;
      patchDraft((d) => ({ ...d, ambientes: [...d.ambientes, amb] }), false);
      setAmbienteActivoId(amb.id);
    } else {
      toast.error(res.message || 'No se pudo crear el ambiente');
    }
  };

  const handleRenameAmbiente = async (amb: AmbienteUI) => {
    const nombre = (await pedir({
      titulo: 'Renombrar ambiente',
      label: 'Nombre',
      defaultValue: amb.nombre,
      confirmLabel: 'Guardar',
    }))?.trim();
    if (!nombre || nombre === amb.nombre) return;
    patchDraft(
      (d) => ({ ...d, ambientes: d.ambientes.map((a) => (a.id === amb.id ? { ...a, nombre } : a)) }),
      false
    );
    const res = await renombrarAmbiente(amb.id, nombre);
    if (!res.success) toast.error(res.message || 'No se pudo renombrar');
  };

  const handleDeleteAmbiente = async (amb: AmbienteUI) => {
    if (ambientes.length <= 1) {
      toast.error('Tiene que quedar al menos un ambiente');
      return;
    }
    if (!(await confirm({
      titulo: `¿Eliminar el ambiente "${amb.nombre}"?`,
      descripcion: 'Sus mesas quedarán sin asignar.',
      confirmLabel: 'Eliminar',
      destructivo: true,
    }))) return;
    const res = await eliminarAmbiente(amb.id);
    if (!res.success) {
      toast.error(res.message || 'No se pudo eliminar');
      return;
    }
    const restantes = ambientes.filter((a) => a.id !== amb.id);
    const destino = restantes[0]?.id ?? null;
    patchDraft(
      (d) => ({
        ...d,
        ambientes: restantes,
        mesas: d.mesas.map((m) => (m.ambienteId === amb.id ? { ...m, ambienteId: destino } : m)),
        elementos: d.elementos.filter((e) => e.ambienteId !== amb.id),
      }),
      false
    );
    if (activeId === amb.id) setAmbienteActivoId(destino ?? '');
  };

  const handleDeleteMesa = async (id: string) => {
    const mesa = mesas.find((m) => m.id === id);
    if (!(await confirm({
      titulo: `¿Eliminar ${mesa?.identificador ?? 'la mesa'}?`,
      confirmLabel: 'Eliminar',
      destructivo: true,
    }))) return;
    // Optimista: sacar al instante y restaurar si falla
    patchDraft((d) => ({ ...d, mesas: d.mesas.filter((m) => m.id !== id) }), false);
    setSeleccion(null);
    if (id.startsWith('temp-')) return; // todavía no existía en el server
    const res = await eliminarMesaPlano(id);
    if (!res.success) {
      if (mesa) patchDraft((d) => ({ ...d, mesas: [...d.mesas, mesa] }), false);
      toast.error(res.message || 'No se pudo eliminar');
    }
  };

  const handleCreateElemento = async (rect: {
    tipo: Herramienta;
    posX: number;
    posY: number;
    ancho: number;
    alto: number;
    rotacion?: number;
  }) => {
    const tipo = rect.tipo === 'barra' ? 'barra' : 'pared';
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimista: ElementoPlanoUI = {
      id: tempId,
      ambienteId: activeId,
      tipo,
      posX: rect.posX,
      posY: rect.posY,
      ancho: rect.ancho,
      alto: rect.alto,
      rotacion: rect.rotacion ?? 0,
      etiqueta: null,
    };
    patchDraft((d) => ({ ...d, elementos: [...d.elementos, optimista] }), false);

    const res = await crearElementoPlano({
      ambienteId: activeId,
      tipo,
      posX: rect.posX,
      posY: rect.posY,
      ancho: rect.ancho,
      alto: rect.alto,
      rotacion: rect.rotacion ?? 0,
    });
    if (res.success && res.elemento) {
      const real = res.elemento as ElementoPlanoUI;
      patchDraft((d) => ({ ...d, elementos: d.elementos.map((e) => (e.id === tempId ? real : e)) }), false);
    } else {
      patchDraft((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== tempId) }), false);
      toast.error(res.message || 'No se pudo crear el elemento');
    }
  };

  const handleDeleteElemento = async (id: string) => {
    const elemento = elementos.find((e) => e.id === id);
    // Optimista: sacar al instante y restaurar si falla
    patchDraft((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== id) }), false);
    setSeleccion(null);
    if (id.startsWith('temp-')) return; // todavía no existía en el server
    const res = await eliminarElementoPlano(id);
    if (!res.success) {
      if (elemento) patchDraft((d) => ({ ...d, elementos: [...d.elementos, elemento] }), false);
      toast.error(res.message || 'No se pudo eliminar');
    }
  };

  // ---- Operación (modo ver) ----
  const handleLiberar = async (mesa: MesaPlano) => {
    if (!(await confirm({
      titulo: `¿Liberar ${mesa.identificador}?`,
      descripcion: 'Se cerrará la sesión actual.',
      confirmLabel: 'Liberar',
      destructivo: true,
    }))) return;
    setLiberandoId(mesa.id);
    const res = await liberarMesaAction(mesa.id);
    setLiberandoId(null);
    if (res.success) queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    else toast.error(res.message || 'No se pudo liberar la mesa');
  };

  // Abre la mesa (ocupa) sin que el cliente escanee y lleva al mozo a cargar el pedido.
  const handleAbrir = async (mesa: MesaPlano) => {
    setAbriendoId(mesa.id);
    const res = await abrirMesaAction(mesa.id);
    setAbriendoId(null);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
      router.push(`/admin/mesas/${mesa.id}`);
    } else {
      toast.error(res.message || 'No se pudo abrir la mesa');
    }
  };

  const handleDividir = async (mesa: MesaPlano) => {
    const def = Math.max(1, Math.floor(mesa.capacidad / 2));
    const entrada = await pedir({
      titulo: `Dividir ${mesa.identificador}`,
      descripcion: `${mesa.capacidad} lugares. ¿Cuántos para la nueva sub-mesa?`,
      label: 'Lugares',
      tipo: 'number',
      defaultValue: String(def),
      confirmLabel: 'Dividir',
    });
    if (entrada == null) return;
    const cap = parseInt(entrada, 10);
    if (!Number.isFinite(cap) || cap < 1 || cap >= mesa.capacidad) {
      toast.error(`Tiene que ser un número entre 1 y ${mesa.capacidad - 1}.`);
      return;
    }
    const res = await dividirMesaAction(mesa.id, cap);
    if (res.success) {
      if (res.mesa) setSeleccion({ tipo: 'mesa', id: (res.mesa as { id: string }).id });
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      toast.error(res.message || 'No se pudo dividir la mesa');
    }
  };

  const handleUnir = async (mesa: MesaPlano) => {
    if (!(await confirm({
      titulo: `¿Volver a unir ${mesa.identificador}?`,
      descripcion: 'Se une con su mesa madre.',
      confirmLabel: 'Unir',
    }))) return;
    const res = await unirMesaAction(mesa.id);
    if (res.success) {
      setSeleccion(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      toast.error(res.message || 'No se pudo unir la mesa');
    }
  };

  // ---- Guardado batch de la geometría ----
  const guardar = async () => {
    if (!draft) return;
    setGuardando(true);
    // Ignorar ids temporales: corresponden a creaciones aún sin confirmar en el server
    const res = await guardarLayoutAction({
      mesas: draft.mesas.filter((m) => !m.id.startsWith('temp-')).map((m) => ({
        id: m.id,
        ambienteId: m.ambienteId,
        posX: m.posX,
        posY: m.posY,
        ancho: m.ancho,
        alto: m.alto,
        forma: m.forma,
        capacidad: m.capacidad,
        rotacion: m.rotacion,
      })),
      elementos: draft.elementos.filter((e) => !e.id.startsWith('temp-')).map((e) => ({
        id: e.id,
        posX: e.posX,
        posY: e.posY,
        ancho: e.ancho,
        alto: e.alto,
        rotacion: e.rotacion,
        etiqueta: e.etiqueta,
      })),
    });
    setGuardando(false);
    if (res.success) {
      setDirty(false);
      // Sincroniza el plano para cuando se vuelva a modo operación.
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      toast.error(res.message || 'No se pudo guardar el plano');
    }
  };

  return {
    updateMesa,
    updateElemento,
    handleAddMesa,
    handleAddAmbiente,
    handleRenameAmbiente,
    handleDeleteAmbiente,
    handleDeleteMesa,
    handleCreateElemento,
    handleDeleteElemento,
    handleLiberar,
    handleAbrir,
    handleDividir,
    handleUnir,
    guardar,
    // Diálogos estilados (confirm/prompt) que el manager debe renderizar.
    confirmDialog,
    promptDialog,
  };
}
