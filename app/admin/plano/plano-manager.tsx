'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Eye,
  Plus,
  Save,
  Trash2,
  RotateCw,
  Square,
  Circle,
  MousePointer2,
  Minus,
} from 'lucide-react';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import {
  crearAmbiente,
  renombrarAmbiente,
  eliminarAmbiente,
  crearMesaEnPlano,
  eliminarMesaPlano,
  crearElementoPlano,
  eliminarElementoPlano,
  guardarLayoutAction,
} from '@/features/mesas/plano-actions';
import { PlanoCanvas } from './plano-canvas';
import {
  type AmbienteUI,
  type ElementoPlanoUI,
  type Herramienta,
  type MesaPlano,
  type Modo,
  type Seleccion,
} from './plano-types';

interface Draft {
  ambientes: AmbienteUI[];
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
}

export function PlanoManager({
  ambientes: initialAmbientes,
  mesas: initialMesas,
  elementos: initialElementos,
  userRole,
  tenantId,
}: {
  ambientes: AmbienteUI[];
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
  userRole: string;
  tenantId: string;
}) {
  const router = useRouter();
  const canManage = hasPermission(userRole as RoleType, 'canManageTables');

  const [modo, setModo] = useState<Modo>('ver');
  // Copia de trabajo: solo existe mientras se edita. En modo operación se
  // renderiza directo desde los props (refleja la ocupación en vivo).
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ambienteActivoId, setAmbienteActivoId] = useState<string>(initialAmbientes[0]?.id ?? '');
  const [herramienta, setHerramienta] = useState<Herramienta>('seleccionar');
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const editando = modo === 'editar';

  const modoRef = useRef(modo);
  useEffect(() => {
    modoRef.current = modo;
  }, [modo]);

  // Realtime: cambios de ocupación → refrescar (solo en modo operación)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`admin_restaurant_${tenantId}`);
    channel
      .on('broadcast', { event: 'ocupacion_cambiada' }, () => {
        if (modoRef.current === 'ver') router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, router]);

  // Fuente de datos según el modo
  const ambientes = editando && draft ? draft.ambientes : initialAmbientes;
  const mesas = editando && draft ? draft.mesas : initialMesas;
  const elementos = editando && draft ? draft.elementos : initialElementos;

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

  // ---- Mutaciones de la copia de trabajo ----
  const patchDraft = (fn: (d: Draft) => Draft, marcarDirty = true) => {
    setDraft((d) => (d ? fn(d) : d));
    if (marcarDirty) setDirty(true);
  };

  const updateMesa = (id: string, partial: Partial<MesaPlano>) =>
    patchDraft((d) => ({ ...d, mesas: d.mesas.map((m) => (m.id === id ? { ...m, ...partial } : m)) }));

  const updateElemento = (id: string, partial: Partial<ElementoPlanoUI>) =>
    patchDraft((d) => ({ ...d, elementos: d.elementos.map((e) => (e.id === id ? { ...e, ...partial } : e)) }));

  // ---- Acciones que persisten al instante ----
  const handleAddMesa = async () => {
    const nombre = window.prompt('Identificador de la mesa (ej: Mesa 5):')?.trim();
    if (!nombre) return;
    const res = await crearMesaEnPlano(activeId, nombre);
    if (res.success && res.mesa) {
      const mesa = res.mesa as MesaPlano;
      patchDraft((d) => ({ ...d, mesas: [...d.mesas, mesa] }), false);
      setSeleccion({ tipo: 'mesa', id: mesa.id });
    } else {
      alert(res.message || 'No se pudo crear la mesa');
    }
  };

  const handleAddAmbiente = async () => {
    const nombre = window.prompt('Nombre del ambiente (ej: Patio):')?.trim();
    if (!nombre) return;
    const res = await crearAmbiente(nombre);
    if (res.success && res.ambiente) {
      const amb = res.ambiente as AmbienteUI;
      patchDraft((d) => ({ ...d, ambientes: [...d.ambientes, amb] }), false);
      setAmbienteActivoId(amb.id);
    } else {
      alert(res.message || 'No se pudo crear el ambiente');
    }
  };

  const handleRenameAmbiente = async (amb: AmbienteUI) => {
    const nombre = window.prompt('Nuevo nombre del ambiente:', amb.nombre)?.trim();
    if (!nombre || nombre === amb.nombre) return;
    patchDraft(
      (d) => ({ ...d, ambientes: d.ambientes.map((a) => (a.id === amb.id ? { ...a, nombre } : a)) }),
      false
    );
    const res = await renombrarAmbiente(amb.id, nombre);
    if (!res.success) alert(res.message || 'No se pudo renombrar');
  };

  const handleDeleteAmbiente = async (amb: AmbienteUI) => {
    if (ambientes.length <= 1) {
      alert('Tiene que quedar al menos un ambiente');
      return;
    }
    if (!confirm(`¿Eliminar el ambiente "${amb.nombre}"? Sus mesas quedarán sin asignar.`)) return;
    const res = await eliminarAmbiente(amb.id);
    if (!res.success) {
      alert(res.message || 'No se pudo eliminar');
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
    if (!confirm(`¿Eliminar ${mesa?.identificador ?? 'la mesa'}?`)) return;
    const res = await eliminarMesaPlano(id);
    if (!res.success) {
      alert(res.message || 'No se pudo eliminar');
      return;
    }
    patchDraft((d) => ({ ...d, mesas: d.mesas.filter((m) => m.id !== id) }), false);
    setSeleccion(null);
  };

  const handleCreateElemento = async (rect: {
    tipo: Herramienta;
    posX: number;
    posY: number;
    ancho: number;
    alto: number;
  }) => {
    const tipo = rect.tipo === 'barra' ? 'barra' : 'pared';
    const res = await crearElementoPlano({
      ambienteId: activeId,
      tipo,
      posX: rect.posX,
      posY: rect.posY,
      ancho: rect.ancho,
      alto: rect.alto,
    });
    if (res.success && res.elemento) {
      const elemento = res.elemento as ElementoPlanoUI;
      patchDraft((d) => ({ ...d, elementos: [...d.elementos, elemento] }), false);
    } else {
      alert(res.message || 'No se pudo crear el elemento');
    }
  };

  const handleDeleteElemento = async (id: string) => {
    const res = await eliminarElementoPlano(id);
    if (!res.success) {
      alert(res.message || 'No se pudo eliminar');
      return;
    }
    patchDraft((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== id) }), false);
    setSeleccion(null);
  };

  // ---- Guardado batch de la geometría ----
  const guardar = async () => {
    if (!draft) return;
    setGuardando(true);
    const res = await guardarLayoutAction({
      mesas: draft.mesas.map((m) => ({
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
      elementos: draft.elementos.map((e) => ({
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
      router.refresh(); // sincroniza los props para cuando se vuelva a modo operación
    } else {
      alert(res.message || 'No se pudo guardar el plano');
    }
  };

  const entrarEdicion = () => {
    setDraft({ ambientes: initialAmbientes, mesas: initialMesas, elementos: initialElementos });
    setDirty(false);
    setModo('editar');
  };

  const salirEdicion = () => {
    if (dirty && !confirm('Tenés cambios sin guardar. ¿Salir y descartarlos?')) return;
    setDraft(null);
    setSeleccion(null);
    setHerramienta('seleccionar');
    setDirty(false);
    setModo('ver');
  };

  const toggleModo = () => (editando ? salirEdicion() : entrarEdicion());

  const cambiarAmbiente = (id: string) => {
    if (id === activeId) return;
    setSeleccion(null);
    setAmbienteActivoId(id);
  };

  const onOpenMesa = (mesa: MesaPlano) => {
    if (mesa.ocupada) {
      router.push(`/admin/mesas/${mesa.id}`);
    } else {
      alert(`${mesa.identificador} está libre (sin sesión activa).`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* Barra superior: pestañas + modo */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {ambientes.map((amb) => {
            const activo = amb.id === activeId;
            return (
              <button
                key={amb.id}
                onClick={() => cambiarAmbiente(amb.id)}
                onDoubleClick={() => editando && handleRenameAmbiente(amb)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activo ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={editando ? 'Doble clic para renombrar' : undefined}
              >
                {amb.nombre}
              </button>
            );
          })}
          {editando && (
            <button
              onClick={handleAddAmbiente}
              className="px-2.5 py-1.5 rounded-md text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 flex items-center gap-1"
            >
              <Plus size={14} /> Ambiente
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/mesas"
            className="text-sm text-gray-500 hover:text-blue-600 underline underline-offset-2"
          >
            Ir a Mesas / QR
          </Link>
          {canManage && (
            <button
              onClick={toggleModo}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition ${
                editando ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {editando ? (
                <>
                  <Eye size={16} /> Modo operación
                </>
              ) : (
                <>
                  <Pencil size={16} /> Editar plano
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Barra de herramientas (solo edición) */}
      {editando && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
          <ToolButton active={herramienta === 'seleccionar'} onClick={() => setHerramienta('seleccionar')}>
            <MousePointer2 size={14} /> Mover
          </ToolButton>
          <ToolButton active={herramienta === 'pared'} onClick={() => setHerramienta('pared')}>
            <Minus size={14} /> Pared
          </ToolButton>
          <ToolButton active={herramienta === 'barra'} onClick={() => setHerramienta('barra')}>
            <Square size={14} /> Barra
          </ToolButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={handleAddMesa}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100"
          >
            <Plus size={14} /> Mesa
          </button>
          {ambienteActivo && ambientes.length > 1 && (
            <button
              onClick={() => handleDeleteAmbiente(ambienteActivo)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
              title="Eliminar el ambiente actual"
            >
              <Trash2 size={14} /> Ambiente
            </button>
          )}
          <div className="flex-1" />
          {dirty && <span className="text-xs text-amber-600 font-medium">Cambios sin guardar</span>}
          <button
            onClick={guardar}
            disabled={!dirty || guardando}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            <Save size={15} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Área principal: lienzo + panel de selección */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          {activeId ? (
            <PlanoCanvas
              mesas={mesasAmbiente}
              elementos={elementosAmbiente}
              modo={modo}
              herramienta={herramienta}
              seleccion={seleccion}
              onChangeMesa={updateMesa}
              onChangeElemento={updateElemento}
              onSelect={setSeleccion}
              onCreateElemento={handleCreateElemento}
              onOpenMesa={onOpenMesa}
            />
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
              No hay ambientes. {canManage && 'Creá uno para empezar.'}
            </div>
          )}
          {!editando && (
            <p className="mt-2 text-xs text-gray-400">
              Verde = libre · Naranja = ocupada · Tocá una mesa ocupada para ver/cargar su pedido.
            </p>
          )}
        </div>

        {/* Panel de selección (edición) */}
        {editando && (selMesa || selElemento) && (
          <div className="lg:w-72 shrink-0 border border-gray-200 rounded-lg p-4 bg-gray-50 h-fit">
            {selMesa && (
              <MesaPanel
                mesa={selMesa}
                ambientes={ambientes}
                onUpdate={(p) => updateMesa(selMesa.id, p)}
                onDelete={() => handleDeleteMesa(selMesa.id)}
              />
            )}
            {selElemento && (
              <ElementoPanel
                elemento={selElemento}
                onUpdate={(p) => updateElemento(selElemento.id, p)}
                onDelete={() => handleDeleteElemento(selElemento.id)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function MesaPanel({
  mesa,
  ambientes,
  onUpdate,
  onDelete,
}: {
  mesa: MesaPlano;
  ambientes: AmbienteUI[];
  onUpdate: (p: Partial<MesaPlano>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-800">{mesa.identificador}</h3>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Forma</label>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onUpdate({ forma: 'cuadrada' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma !== 'redonda' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
            }`}
          >
            <Square size={14} /> Cuadrada
          </button>
          <button
            onClick={() => onUpdate({ forma: 'redonda' })}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-sm border ${
              mesa.forma === 'redonda' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
            }`}
          >
            <Circle size={14} /> Redonda
          </button>
        </div>
      </div>

      <Stepper
        label="Capacidad (sillas)"
        value={mesa.capacidad}
        onDec={() => onUpdate({ capacidad: Math.max(1, mesa.capacidad - 1) })}
        onInc={() => onUpdate({ capacidad: mesa.capacidad + 1 })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={mesa.ancho}
          onDec={() => onUpdate({ ancho: Math.max(1, mesa.ancho - 1) })}
          onInc={() => onUpdate({ ancho: mesa.ancho + 1 })}
        />
        <Stepper
          label="Alto"
          value={mesa.alto}
          onDec={() => onUpdate({ alto: Math.max(1, mesa.alto - 1) })}
          onInc={() => onUpdate({ alto: mesa.alto + 1 })}
        />
      </div>

      <button
        onClick={() => onUpdate({ rotacion: (mesa.rotacion + 90) % 360 })}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-gray-200 bg-white hover:bg-gray-100"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Ambiente</label>
        <select
          value={mesa.ambienteId ?? ''}
          onChange={(e) => onUpdate({ ambienteId: e.target.value })}
          className="w-full mt-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
        >
          {ambientes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
      >
        <Trash2 size={14} /> Eliminar mesa
      </button>
    </div>
  );
}

function ElementoPanel({
  elemento,
  onUpdate,
  onDelete,
}: {
  elemento: ElementoPlanoUI;
  onUpdate: (p: Partial<ElementoPlanoUI>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-800 capitalize">{elemento.tipo}</h3>

      {elemento.tipo === 'barra' && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Etiqueta</label>
          <input
            type="text"
            value={elemento.etiqueta ?? ''}
            onChange={(e) => onUpdate({ etiqueta: e.target.value })}
            placeholder="Ej: Barra"
            className="w-full mt-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Ancho"
          value={elemento.ancho}
          onDec={() => onUpdate({ ancho: Math.max(1, elemento.ancho - 1) })}
          onInc={() => onUpdate({ ancho: elemento.ancho + 1 })}
        />
        <Stepper
          label="Alto"
          value={elemento.alto}
          onDec={() => onUpdate({ alto: Math.max(1, elemento.alto - 1) })}
          onInc={() => onUpdate({ alto: elemento.alto + 1 })}
        />
      </div>

      <button
        onClick={() => onUpdate({ rotacion: (elemento.rotacion + 90) % 360 })}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm border border-gray-200 bg-white hover:bg-gray-100"
      >
        <RotateCw size={14} /> Rotar 90°
      </button>

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
      >
        <Trash2 size={14} /> Eliminar elemento
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onDec}
          className="w-8 h-8 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-lg leading-none"
        >
          −
        </button>
        <span className="flex-1 text-center font-semibold text-gray-800">{value}</span>
        <button
          onClick={onInc}
          className="w-8 h-8 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}
