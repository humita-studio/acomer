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

type PlanoStore = {
  // --- Estado de UI del editor ---
  modo: Modo;
  /** Solo existe mientras se edita; en modo operación se lee del server (query). */
  draft: PlanoDraft | null;
  ambienteActivoId: string;
  herramienta: Herramienta;
  seleccion: Seleccion | null;
  dirty: boolean;
  guardando: boolean;
  liberandoId: string | null;
  mostrarLista: boolean;
  avisos: Aviso[];

  // --- Setters ---
  setModo: (modo: Modo) => void;
  setAmbienteActivoId: (id: string) => void;
  setHerramienta: (h: Herramienta) => void;
  setSeleccion: (sel: Seleccion | null | ((prev: Seleccion | null) => Seleccion | null)) => void;
  setDirty: (dirty: boolean) => void;
  setGuardando: (guardando: boolean) => void;
  setLiberandoId: (id: string | null) => void;
  setMostrarLista: (v: boolean | ((prev: boolean) => boolean)) => void;

  /** Muta la copia de trabajo; por defecto marca cambios sin guardar. */
  patchDraft: (fn: (d: PlanoDraft) => PlanoDraft, marcarDirty?: boolean) => void;

  // --- Avisos en vivo (autodescartan a los 20s) ---
  pushAviso: (texto: string) => void;
  removeAviso: (id: string) => void;

  // --- Transiciones de modo ---
  iniciarEdicion: (base: PlanoDraft) => void;
  terminarEdicion: () => void;
  /** Vuelve al estado inicial (al desmontar el editor). */
  reset: () => void;
};

const initialState = {
  modo: 'ver' as Modo,
  draft: null as PlanoDraft | null,
  ambienteActivoId: '',
  herramienta: 'seleccionar' as Herramienta,
  seleccion: null as Seleccion | null,
  dirty: false,
  guardando: false,
  liberandoId: null as string | null,
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
  setDirty: (dirty) => set({ dirty }),
  setGuardando: (guardando) => set({ guardando }),
  setLiberandoId: (liberandoId) => set({ liberandoId }),
  setMostrarLista: (v) =>
    set((s) => ({ mostrarLista: typeof v === 'function' ? v(s.mostrarLista) : v })),

  patchDraft: (fn, marcarDirty = true) =>
    set((s) => ({
      draft: s.draft ? fn(s.draft) : s.draft,
      dirty: marcarDirty ? true : s.dirty,
    })),

  pushAviso: (texto) => {
    const id = crypto.randomUUID();
    set((s) => ({ avisos: [{ id, texto }, ...s.avisos].slice(0, 5) }));
    setTimeout(() => get().removeAviso(id), 20000);
  },
  removeAviso: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })),

  iniciarEdicion: (base) =>
    set({ draft: base, dirty: false, seleccion: null, mostrarLista: false, modo: 'editar' }),
  terminarEdicion: () =>
    set({ draft: null, seleccion: null, herramienta: 'seleccionar', dirty: false, modo: 'ver' }),
  reset: () => set({ ...initialState }),
}));
