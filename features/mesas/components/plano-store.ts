import { create } from 'zustand';
import type {
  AmbienteUI,
  ElementoPlanoUI,
  Herramienta,
  MesaPlano,
  Modo,
  Seleccion,
} from './plano-types';

/** Copia de trabajo del plano mientras se edita. */
export interface PlanoDraft {
  ambientes: AmbienteUI[];
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
}

type Aviso = { id: string; texto: string };

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type PlanoStore = {
  // --- Estado de UI del editor ---
  modo: Modo;
  /** Solo existe mientras se edita; en modo operación se lee del server (query). */
  draft: PlanoDraft | null;
  ambienteActivoId: string;
  herramienta: Herramienta;
  seleccion: Seleccion | null;
  /** Alinea posición/tamaño a media celda al soltar o colocar. */
  snapEnabled: boolean;
  /** Monótono: sube con cada cambio de geometría del draft. */
  layoutRevision: number;
  /** Última revisión confirmada por el server. dirty = layoutRevision > savedRevision. */
  savedRevision: number;
  guardando: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
  liberandoId: string | null;
  abriendoId: string | null;
  mostrarLista: boolean;
  avisos: Aviso[];

  // --- Setters ---
  setModo: (modo: Modo) => void;
  setAmbienteActivoId: (id: string) => void;
  setHerramienta: (h: Herramienta) => void;
  setSeleccion: (sel: Seleccion | null | ((prev: Seleccion | null) => Seleccion | null)) => void;
  setSnapEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  setGuardando: (guardando: boolean) => void;
  setSaveError: (err: string | null) => void;
  markSaved: (revision: number) => void;
  setLiberandoId: (id: string | null) => void;
  setAbriendoId: (id: string | null) => void;
  setMostrarLista: (v: boolean | ((prev: boolean) => boolean)) => void;

  /** Muta la copia de trabajo; por defecto marca cambios sin guardar (sube layoutRevision). */
  patchDraft: (fn: (d: PlanoDraft) => PlanoDraft, marcarDirty?: boolean) => void;

  // --- Avisos en vivo (autodescartan a los 20s) ---
  pushAviso: (texto: string) => void;
  removeAviso: (id: string) => void;

  // --- Transiciones de modo ---
  iniciarEdicion: (base: PlanoDraft) => void;
  terminarEdicion: () => void;
  /** Vuelve al estado inicial (al desmontar el editor). */
  reset: () => void;

  /** Helpers derivados (no se suscriben solos; el caller los usa al leer estado). */
  isDirty: () => boolean;
  saveStatus: () => SaveStatus;
};

const initialState = {
  modo: 'ver' as Modo,
  draft: null as PlanoDraft | null,
  ambienteActivoId: '',
  herramienta: 'seleccionar' as Herramienta,
  seleccion: null as Seleccion | null,
  snapEnabled: true,
  layoutRevision: 0,
  savedRevision: 0,
  guardando: false,
  saveError: null as string | null,
  lastSavedAt: null as number | null,
  liberandoId: null as string | null,
  abriendoId: null as string | null,
  mostrarLista: false,
  avisos: [] as Aviso[],
};

export const usePlanoStore = create<PlanoStore>()((set, get) => ({
  ...initialState,

  setModo: (modo) => set({ modo }),
  setAmbienteActivoId: (ambienteActivoId) => set({ ambienteActivoId }),
  setHerramienta: (herramienta) => set({ herramienta }),
  setSeleccion: (sel) =>
    set((s) => ({
      seleccion: typeof sel === 'function' ? sel(s.seleccion) : sel,
    })),
  setSnapEnabled: (v) =>
    set((s) => ({ snapEnabled: typeof v === 'function' ? v(s.snapEnabled) : v })),
  setGuardando: (guardando) => set({ guardando }),
  setSaveError: (saveError) => set({ saveError }),
  markSaved: (revision) =>
    set((s) => {
      // Solo avanza si no hubo ediciones más nuevas durante el roundtrip.
      if (revision !== s.layoutRevision) return { guardando: false };
      return {
        savedRevision: revision,
        guardando: false,
        saveError: null,
        lastSavedAt: Date.now(),
      };
    }),
  setLiberandoId: (liberandoId) => set({ liberandoId }),
  setAbriendoId: (abriendoId) => set({ abriendoId }),
  setMostrarLista: (v) =>
    set((s) => ({ mostrarLista: typeof v === 'function' ? v(s.mostrarLista) : v })),

  patchDraft: (fn, marcarDirty = true) =>
    set((s) => {
      if (!s.draft) return s;
      return {
        draft: fn(s.draft),
        layoutRevision: marcarDirty ? s.layoutRevision + 1 : s.layoutRevision,
        saveError: marcarDirty ? null : s.saveError,
      };
    }),

  pushAviso: (texto) => {
    const id = crypto.randomUUID();
    set((s) => ({ avisos: [{ id, texto }, ...s.avisos].slice(0, 5) }));
    setTimeout(() => get().removeAviso(id), 20000);
  },
  removeAviso: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })),

  iniciarEdicion: (base) =>
    set({
      draft: base,
      layoutRevision: 0,
      savedRevision: 0,
      saveError: null,
      lastSavedAt: null,
      guardando: false,
      seleccion: null,
      mostrarLista: false,
      modo: 'editar',
    }),
  terminarEdicion: () =>
    set({
      draft: null,
      seleccion: null,
      herramienta: 'seleccionar',
      layoutRevision: 0,
      savedRevision: 0,
      saveError: null,
      lastSavedAt: null,
      guardando: false,
      modo: 'ver',
    }),
  reset: () => set({ ...initialState }),

  isDirty: () => {
    const s = get();
    return s.layoutRevision > s.savedRevision;
  },
  saveStatus: () => {
    const s = get();
    if (s.guardando) return 'saving';
    if (s.saveError) return 'error';
    if (s.layoutRevision > s.savedRevision) return 'dirty';
    if (s.lastSavedAt) return 'saved';
    return 'idle';
  },
}));
