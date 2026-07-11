'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
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
import type { PlanoData } from '@/features/mesas/plano-data';
import { queryKeys } from '@/shared/query/keys';
import { usePlanoStore, type PlanoDraft } from './plano-store';
import {
  COLS,
  ROWS,
  type AmbienteUI,
  type ElementoPlanoUI,
  type Herramienta,
  type MesaPlano,
} from './plano-types';

const AUTOSAVE_MS = 650;

function nextMesaNombre(mesas: MesaPlano[]): string {
  let max = 0;
  for (const m of mesas) {
    const match = m.identificador.match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `Mesa ${max + 1}`;
}

function nextAmbienteNombre(ambientes: AmbienteUI[]): string {
  let max = 0;
  for (const a of ambientes) {
    const match = a.nombre.match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  // Primer ambiente suele ser "Salón"; el siguiente "Ambiente 2", etc.
  return max > 0 ? `Ambiente ${max + 1}` : `Ambiente ${ambientes.length + 1}`;
}

/** Busca un hueco libre en la grilla del ambiente (evita apilar mesas en 1,1). */
function findFreeSpot(
  mesasAmbiente: MesaPlano[],
  ancho = 2,
  alto = 2,
): { posX: number; posY: number } {
  const step = 0.5;
  for (let y = 1; y <= ROWS - alto; y += step) {
    for (let x = 1; x <= COLS - ancho; x += step) {
      const collides = mesasAmbiente.some((m) => {
        return !(
          x + ancho <= m.posX ||
          m.posX + m.ancho <= x ||
          y + alto <= m.posY ||
          m.posY + m.alto <= y
        );
      });
      if (!collides) {
        return {
          posX: Math.round(x * 100) / 100,
          posY: Math.round(y * 100) / 100,
        };
      }
    }
  }
  return { posX: 1, posY: 1 };
}

function mapMesaFromServer(raw: Record<string, unknown>, fallback?: MesaPlano): MesaPlano {
  return {
    id: String(raw.id),
    identificador: String(raw.identificador ?? fallback?.identificador ?? ''),
    qrToken: String(raw.qrToken ?? fallback?.qrToken ?? ''),
    parentMesaId: (raw.parentMesaId as string | null) ?? fallback?.parentMesaId ?? null,
    ambienteId: (raw.ambienteId as string | null) ?? fallback?.ambienteId ?? null,
    posX: Number(raw.posX ?? fallback?.posX ?? 1),
    posY: Number(raw.posY ?? fallback?.posY ?? 1),
    ancho: Number(raw.ancho ?? fallback?.ancho ?? 2),
    alto: Number(raw.alto ?? fallback?.alto ?? 2),
    forma: String(raw.forma ?? fallback?.forma ?? 'cuadrada'),
    capacidad: Number(raw.capacidad ?? fallback?.capacidad ?? 4),
    rotacion: Number(raw.rotacion ?? fallback?.rotacion ?? 0),
    ocupada: fallback?.ocupada ?? false,
  };
}

/**
 * Acciones del editor de plano.
 * - Geometría: draft local + autosave con debounce.
 * - CRUD: optimista (UI al instante, reconcilia id real / revierte).
 * - Operación: cache TanStack optimista (abrir/liberar).
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
  const patchDraft = usePlanoStore((s) => s.patchDraft);
  const setSeleccion = usePlanoStore((s) => s.setSeleccion);
  const setAmbienteActivoId = usePlanoStore((s) => s.setAmbienteActivoId);
  const setLiberandoId = usePlanoStore((s) => s.setLiberandoId);
  const setAbriendoId = usePlanoStore((s) => s.setAbriendoId);
  const setGuardando = usePlanoStore((s) => s.setGuardando);
  const setSaveError = usePlanoStore((s) => s.setSaveError);
  const markSaved = usePlanoStore((s) => s.markSaved);

  const layoutRevision = usePlanoStore((s) => s.layoutRevision);
  const savedRevision = usePlanoStore((s) => s.savedRevision);
  const modo = usePlanoStore((s) => s.modo);
  const dirty = layoutRevision > savedRevision;

  const savingRef = useRef(false);
  const flushWaiters = useRef<Array<(ok: boolean) => void>>([]);

  const syncPlanoCacheFromDraft = useCallback(
    (d: PlanoDraft) => {
      queryClient.setQueryData<PlanoData>(queryKeys.plano(tenantId), (prev) => {
        // Conserva flags de ocupación del cache (no vienen del draft de geometría).
        const ocupacion = new Map((prev?.mesas ?? []).map((m) => [m.id, !!m.ocupada]));
        return {
          ambientes: d.ambientes,
          mesas: d.mesas.map((m) => ({
            ...m,
            ocupada: ocupacion.get(m.id) ?? !!m.ocupada,
          })),
          elementos: d.elementos,
        };
      });
    },
    [queryClient, tenantId],
  );

  const patchOcupacion = useCallback(
    (mesaId: string, ocupada: boolean) => {
      queryClient.setQueryData<PlanoData>(queryKeys.plano(tenantId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mesas: prev.mesas.map((m) => (m.id === mesaId ? { ...m, ocupada } : m)),
        };
      });
    },
    [queryClient, tenantId],
  );

  // ---- Mutaciones de la copia de trabajo (disparan autosave) ----
  const updateMesa = (id: string, partial: Partial<MesaPlano>) =>
    patchDraft((d) => ({ ...d, mesas: d.mesas.map((m) => (m.id === id ? { ...m, ...partial } : m)) }));

  const updateElemento = (id: string, partial: Partial<ElementoPlanoUI>) =>
    patchDraft((d) => ({
      ...d,
      elementos: d.elementos.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    }));

  // ---- Guardado (autosave + flush al salir) ----
  const guardar = useCallback(
    async (opts?: { revalidate?: boolean; revision?: number }): Promise<boolean> => {
      const state = usePlanoStore.getState();
      const d = state.draft;
      if (!d) return true;

      const revision = opts?.revision ?? state.layoutRevision;
      // Nada que persistir
      if (revision <= state.savedRevision) return true;
      if (savingRef.current) {
        // Ya hay un save en curso; el caller que quiera flush espera al final.
        return new Promise<boolean>((resolve) => {
          flushWaiters.current.push(resolve);
        });
      }

      savingRef.current = true;
      setGuardando(true);
      setSaveError(null);

      const res = await guardarLayoutAction(
        {
          mesas: d.mesas
            .filter((m) => !m.id.startsWith('temp-'))
            .map((m) => ({
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
          elementos: d.elementos
            .filter((e) => !e.id.startsWith('temp-'))
            .map((e) => ({
              id: e.id,
              posX: e.posX,
              posY: e.posY,
              ancho: e.ancho,
              alto: e.alto,
              rotacion: e.rotacion,
              etiqueta: e.etiqueta,
            })),
        },
        { revalidate: opts?.revalidate ?? false },
      );

      savingRef.current = false;

      if (res.success) {
        markSaved(revision);
        // Si el usuario siguió editando, el draft actual puede ser más nuevo:
        // sincronizamos cache con lo que hay ahora (incluye cambios no guardados
        // visualmente; el autosave los va a mandar en el próximo ciclo).
        const latest = usePlanoStore.getState().draft;
        if (latest) syncPlanoCacheFromDraft(latest);

        const waiters = flushWaiters.current.splice(0);
        // Si quedó dirty, no resolvemos "ok final" sin re-guardar.
        const stillDirty = usePlanoStore.getState().layoutRevision > revision;
        if (stillDirty) {
          const ok = await guardar({ revalidate: opts?.revalidate });
          waiters.forEach((w) => w(ok));
          return ok;
        }
        waiters.forEach((w) => w(true));
        return true;
      }

      setGuardando(false);
      setSaveError(res.message || 'No se pudo guardar el plano');
      const waiters = flushWaiters.current.splice(0);
      waiters.forEach((w) => w(false));
      return false;
    },
    [markSaved, setGuardando, setSaveError, syncPlanoCacheFromDraft],
  );

  // Autosave al detectar cambios de geometría.
  useEffect(() => {
    if (modo !== 'editar' || !dirty) return;
    const rev = layoutRevision;
    const t = window.setTimeout(() => {
      void guardar({ revision: rev, revalidate: false });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, layoutRevision, modo, guardar]);

  // Avisa si se va con cambios sin persistir (cierre de pestaña).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (usePlanoStore.getState().layoutRevision > usePlanoStore.getState().savedRevision) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /** Persiste pendientes y devuelve si se pudo salir limpio. */
  const flushSave = useCallback(async () => {
    const state = usePlanoStore.getState();
    if (state.layoutRevision <= state.savedRevision) return true;
    return guardar({ revalidate: true });
  }, [guardar]);

  // ---- CRUD optimista ----
  const handleAddMesa = async () => {
    if (!activeId) return;
    const nombre = nextMesaNombre(mesas);
    const mesasAmb = mesas.filter((m) => m.ambienteId === activeId);
    const spot = findFreeSpot(mesasAmb);
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimista: MesaPlano = {
      id: tempId,
      identificador: nombre,
      qrToken: '',
      parentMesaId: null,
      ambienteId: activeId,
      posX: spot.posX,
      posY: spot.posY,
      ancho: 2,
      alto: 2,
      forma: 'cuadrada',
      capacidad: 4,
      rotacion: 0,
      ocupada: false,
    };
    // No marca dirty: la geometría ya va al server en el insert.
    patchDraft((d) => ({ ...d, mesas: [...d.mesas, optimista] }), false);
    setSeleccion({ tipo: 'mesa', id: tempId });

    const res = await crearMesaEnPlano(activeId, nombre, {
      posX: spot.posX,
      posY: spot.posY,
      ancho: 2,
      alto: 2,
      forma: 'cuadrada',
      capacidad: 4,
      rotacion: 0,
    });
    if (res.success && res.mesa) {
      const real = mapMesaFromServer(res.mesa as unknown as Record<string, unknown>, optimista);
      // Preferir posición local por si el roundtrip reordenó floats.
      const merged = { ...real, posX: optimista.posX, posY: optimista.posY };
      patchDraft(
        (d) => ({ ...d, mesas: d.mesas.map((m) => (m.id === tempId ? merged : m)) }),
        false,
      );
      setSeleccion((s) =>
        s?.tipo === 'mesa' && s.id === tempId ? { tipo: 'mesa', id: merged.id } : s,
      );
      syncPlanoCacheFromDraft(usePlanoStore.getState().draft!);
    } else {
      patchDraft((d) => ({ ...d, mesas: d.mesas.filter((m) => m.id !== tempId) }), false);
      setSeleccion((s) => (s?.tipo === 'mesa' && s.id === tempId ? null : s));
      alert(res.message || 'No se pudo crear la mesa');
    }
  };

  const handleAddAmbiente = async () => {
    const nombre = nextAmbienteNombre(ambientes);
    const tempId = `temp-amb-${crypto.randomUUID()}`;
    const optimista: AmbienteUI = {
      id: tempId,
      nombre,
      orden: ambientes.length,
    };
    patchDraft((d) => ({ ...d, ambientes: [...d.ambientes, optimista] }), false);
    setAmbienteActivoId(tempId);

    const res = await crearAmbiente(nombre);
    if (res.success && res.ambiente) {
      const amb = res.ambiente as AmbienteUI;
      patchDraft(
        (d) => ({
          ...d,
          ambientes: d.ambientes.map((a) => (a.id === tempId ? { ...a, ...amb } : a)),
          mesas: d.mesas.map((m) =>
            m.ambienteId === tempId ? { ...m, ambienteId: amb.id } : m,
          ),
          elementos: d.elementos.map((e) =>
            e.ambienteId === tempId ? { ...e, ambienteId: amb.id } : e,
          ),
        }),
        false,
      );
      setAmbienteActivoId(amb.id);
      const latest = usePlanoStore.getState().draft;
      if (latest) syncPlanoCacheFromDraft(latest);
    } else {
      patchDraft((d) => ({ ...d, ambientes: d.ambientes.filter((a) => a.id !== tempId) }), false);
      if (usePlanoStore.getState().ambienteActivoId === tempId) {
        setAmbienteActivoId(ambientes[0]?.id ?? '');
      }
      alert(res.message || 'No se pudo crear el ambiente');
    }
  };

  const handleRenameAmbiente = async (amb: AmbienteUI) => {
    const nombre = window.prompt('Nuevo nombre del ambiente:', amb.nombre)?.trim();
    if (!nombre || nombre === amb.nombre) return;
    const prev = amb.nombre;
    patchDraft(
      (d) => ({
        ...d,
        ambientes: d.ambientes.map((a) => (a.id === amb.id ? { ...a, nombre } : a)),
      }),
      false,
    );
    const res = await renombrarAmbiente(amb.id, nombre);
    if (!res.success) {
      patchDraft(
        (d) => ({
          ...d,
          ambientes: d.ambientes.map((a) => (a.id === amb.id ? { ...a, nombre: prev } : a)),
        }),
        false,
      );
      alert(res.message || 'No se pudo renombrar');
    } else {
      const latest = usePlanoStore.getState().draft;
      if (latest) syncPlanoCacheFromDraft(latest);
    }
  };

  const handleDeleteAmbiente = async (amb: AmbienteUI) => {
    if (ambientes.length <= 1) {
      alert('Tiene que quedar al menos un ambiente');
      return;
    }
    if (!confirm(`¿Eliminar el ambiente "${amb.nombre}"? Sus mesas se reasignan al resto.`)) return;

    const snapshot = draft;
    const restantes = ambientes.filter((a) => a.id !== amb.id);
    const destino = restantes[0]?.id ?? null;
    patchDraft(
      (d) => ({
        ...d,
        ambientes: restantes,
        mesas: d.mesas.map((m) => (m.ambienteId === amb.id ? { ...m, ambienteId: destino } : m)),
        elementos: d.elementos.filter((e) => e.ambienteId !== amb.id),
      }),
      true, // reasignación de ambiente de mesas → hay que persistir layout
    );
    if (activeId === amb.id) setAmbienteActivoId(destino ?? '');

    if (amb.id.startsWith('temp-')) return;

    const res = await eliminarAmbiente(amb.id);
    if (!res.success) {
      if (snapshot) patchDraft(() => snapshot, false);
      alert(res.message || 'No se pudo eliminar');
    }
  };

  const handleDeleteMesa = async (id: string) => {
    const mesa = mesas.find((m) => m.id === id);
    if (!confirm(`¿Eliminar ${mesa?.identificador ?? 'la mesa'}?`)) return;
    patchDraft((d) => ({ ...d, mesas: d.mesas.filter((m) => m.id !== id) }), false);
    setSeleccion(null);
    if (id.startsWith('temp-')) return;
    const res = await eliminarMesaPlano(id);
    if (!res.success) {
      if (mesa) patchDraft((d) => ({ ...d, mesas: [...d.mesas, mesa] }), false);
      alert(res.message || 'No se pudo eliminar');
    } else {
      const latest = usePlanoStore.getState().draft;
      if (latest) syncPlanoCacheFromDraft(latest);
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
      etiqueta: tipo === 'barra' ? 'Barra' : null,
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
      etiqueta: optimista.etiqueta,
    });
    if (res.success && res.elemento) {
      const real = res.elemento as ElementoPlanoUI;
      patchDraft(
        (d) => ({
          ...d,
          elementos: d.elementos.map((e) =>
            e.id === tempId
              ? {
                  ...optimista,
                  id: real.id,
                  posX: Number(real.posX),
                  posY: Number(real.posY),
                  ancho: Number(real.ancho),
                  alto: Number(real.alto),
                  rotacion: Number(real.rotacion),
                  etiqueta: real.etiqueta,
                }
              : e,
          ),
        }),
        false,
      );
      const latest = usePlanoStore.getState().draft;
      if (latest) syncPlanoCacheFromDraft(latest);
    } else {
      patchDraft((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== tempId) }), false);
      alert(res.message || 'No se pudo crear el elemento');
    }
  };

  const handleDeleteElemento = async (id: string) => {
    const elemento = elementos.find((e) => e.id === id);
    patchDraft((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== id) }), false);
    setSeleccion(null);
    if (id.startsWith('temp-')) return;
    const res = await eliminarElementoPlano(id);
    if (!res.success) {
      if (elemento) patchDraft((d) => ({ ...d, elementos: [...d.elementos, elemento] }), false);
      alert(res.message || 'No se pudo eliminar');
    } else {
      const latest = usePlanoStore.getState().draft;
      if (latest) syncPlanoCacheFromDraft(latest);
    }
  };

  // ---- Operación (modo ver) — optimista en cache ----
  const handleLiberar = async (mesa: MesaPlano) => {
    if (!confirm(`¿Liberar ${mesa.identificador}? Se cerrará la sesión actual.`)) return;
    setLiberandoId(mesa.id);
    patchOcupacion(mesa.id, false);
    setSeleccion(null);
    const res = await liberarMesaAction(mesa.id);
    setLiberandoId(null);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      patchOcupacion(mesa.id, true);
      alert(res.message || 'No se pudo liberar la mesa');
    }
  };

  const handleAbrir = async (mesa: MesaPlano) => {
    setAbriendoId(mesa.id);
    patchOcupacion(mesa.id, true);
    const res = await abrirMesaAction(mesa.id);
    setAbriendoId(null);
    if (res.success) {
      // Navegar ya; el detalle carga la sesión. Cache del plano se alinea al volver.
      router.push(`/admin/mesas/${mesa.id}`);
    } else {
      patchOcupacion(mesa.id, false);
      alert(res.message || 'No se pudo abrir la mesa');
    }
  };

  const handleDividir = async (mesa: MesaPlano) => {
    const def = Math.max(1, Math.floor(mesa.capacidad / 2));
    const entrada = window.prompt(
      `Dividir ${mesa.identificador} (${mesa.capacidad} lugares).\n¿Cuántos lugares para la nueva sub-mesa?`,
      String(def),
    );
    if (entrada == null) return;
    const cap = parseInt(entrada, 10);
    if (!Number.isFinite(cap) || cap < 1 || cap >= mesa.capacidad) {
      alert(`Tiene que ser un número entre 1 y ${mesa.capacidad - 1}.`);
      return;
    }

    // Optimista: achicar madre + crear submesa temporal al lado
    const tempId = `temp-sub-${crypto.randomUUID()}`;
    const snapshot = queryClient.getQueryData<PlanoData>(queryKeys.plano(tenantId));
    queryClient.setQueryData<PlanoData>(queryKeys.plano(tenantId), (prev) => {
      if (!prev) return prev;
      const madre = prev.mesas.find((m) => m.id === mesa.id);
      if (!madre) return prev;
      const sub: PlanoData['mesas'][number] = {
        ...madre,
        id: tempId,
        identificador: `${madre.identificador}B`,
        parentMesaId: madre.id,
        capacidad: cap,
        posX: madre.posX + madre.ancho + 0.5,
        posY: madre.posY,
        ocupada: false,
      };
      return {
        ...prev,
        mesas: [
          ...prev.mesas.map((m) =>
            m.id === mesa.id ? { ...m, capacidad: m.capacidad - cap } : m,
          ),
          sub,
        ],
      };
    });
    setSeleccion({ tipo: 'mesa', id: tempId });

    const res = await dividirMesaAction(mesa.id, cap);
    if (res.success) {
      if (res.mesa) setSeleccion({ tipo: 'mesa', id: (res.mesa as { id: string }).id });
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      if (snapshot) queryClient.setQueryData(queryKeys.plano(tenantId), snapshot);
      setSeleccion(null);
      alert(res.message || 'No se pudo dividir la mesa');
    }
  };

  const handleUnir = async (mesa: MesaPlano) => {
    if (!confirm(`¿Volver a unir ${mesa.identificador} con su mesa madre?`)) return;
    const snapshot = queryClient.getQueryData<PlanoData>(queryKeys.plano(tenantId));
    queryClient.setQueryData<PlanoData>(queryKeys.plano(tenantId), (prev) => {
      if (!prev || !mesa.parentMesaId) return prev;
      const sub = prev.mesas.find((m) => m.id === mesa.id);
      if (!sub) return prev;
      return {
        ...prev,
        mesas: prev.mesas
          .filter((m) => m.id !== mesa.id)
          .map((m) =>
            m.id === mesa.parentMesaId
              ? { ...m, capacidad: m.capacidad + sub.capacidad }
              : m,
          ),
      };
    });
    setSeleccion(null);

    const res = await unirMesaAction(mesa.id);
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
    } else {
      if (snapshot) queryClient.setQueryData(queryKeys.plano(tenantId), snapshot);
      alert(res.message || 'No se pudo unir la mesa');
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
    flushSave,
  };
}
