'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  COLS,
  GRID_PX,
  MIN_CELL,
  ROWS,
  type ElementoPlanoUI,
  type Herramienta,
  type MesaPlano,
  type Modo,
  type Seleccion,
} from './plano-types';
import { MesaNode } from './mesa-node';
import { ElementoNode } from './elemento-node';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

type Draft = { posX: number; posY: number; ancho: number; alto: number } | null;

export function PlanoCanvas({
  mesas,
  elementos,
  modo,
  herramienta,
  seleccion,
  onChangeMesa,
  onChangeElemento,
  onSelect,
  onCreateElemento,
}: {
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
  modo: Modo;
  herramienta: Herramienta;
  seleccion: Seleccion | null;
  onChangeMesa: (id: string, partial: Partial<MesaPlano>) => void;
  onChangeElemento: (id: string, partial: Partial<ElementoPlanoUI>) => void;
  onSelect: (sel: Seleccion | null) => void;
  onCreateElemento: (rect: { tipo: Herramienta; posX: number; posY: number; ancho: number; alto: number }) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef(GRID_PX);
  const draftRef = useRef<Draft>(null);
  const [cell, setCell] = useState(GRID_PX);
  const [draft, setDraft] = useState<Draft>(null);

  const editando = modo === 'editar';
  const puedeArrastrar = editando && herramienta === 'seleccionar';

  // Tamaño de celda responsivo: el lienzo lógico (COLS x ROWS) se mide en px
  // reales por celda (sin scale CSS), así dnd-kit trabaja en las mismas unidades.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const c = clamp(Math.floor(el.clientWidth / COLS), MIN_CELL, GRID_PX);
      cellRef.current = c;
      setCell(c);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Modificador: el preview del arrastre salta a la grilla
  const snapToGrid = useMemo<Modifier>(
    () => ({ transform }) => ({
      ...transform,
      x: Math.round(transform.x / cell) * cell,
      y: Math.round(transform.y / cell) * cell,
    }),
    [cell]
  );

  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { kind: 'mesa' | 'elemento' } | undefined;
    if (d) onSelect({ tipo: d.kind, id: String(e.active.id) });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as
      | { kind: 'mesa' | 'elemento'; posX: number; posY: number; ancho: number; alto: number }
      | undefined;
    if (!d) return;
    const dx = Math.round(e.delta.x / cell);
    const dy = Math.round(e.delta.y / cell);
    if (dx === 0 && dy === 0) return;
    const posX = clamp(d.posX + dx, 0, COLS - d.ancho);
    const posY = clamp(d.posY + dy, 0, ROWS - d.alto);
    if (d.kind === 'mesa') onChangeMesa(String(e.active.id), { posX, posY });
    else onChangeElemento(String(e.active.id), { posX, posY });
  };

  // Redimensionar (el tirador). dnd-kit es para mover, el resize va a mano.
  const beginResize = (
    e: React.PointerEvent,
    kind: 'mesa' | 'elemento',
    node: MesaPlano | ElementoPlanoUI
  ) => {
    if (modo !== 'editar') return;
    e.preventDefault();
    onSelect({ tipo: kind, id: node.id });
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { posX: node.posX, posY: node.posY, ancho: node.ancho, alto: node.alto };
    const c = cellRef.current || GRID_PX;
    const commit = (partial: Partial<MesaPlano & ElementoPlanoUI>) =>
      kind === 'mesa' ? onChangeMesa(node.id, partial) : onChangeElemento(node.id, partial);

    const onMove = (ev: PointerEvent) => {
      const dGX = Math.round((ev.clientX - startX) / c);
      const dGY = Math.round((ev.clientY - startY) / c);
      commit({
        ancho: clamp(orig.ancho + dGX, 1, COLS - orig.posX),
        alto: clamp(orig.alto + dGY, 1, ROWS - orig.posY),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clientToCell = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const c = cellRef.current || GRID_PX;
    const x = clamp(Math.floor((clientX - rect.left) / c), 0, COLS - 1);
    const y = clamp(Math.floor((clientY - rect.top) / c), 0, ROWS - 1);
    return { x, y };
  };

  // Dibujar un elemento (pared / barra) arrastrando sobre el fondo
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (modo !== 'editar') return;
    if (herramienta === 'seleccionar') {
      // Sólo deseleccionar al tocar el fondo vacío (no un nodo)
      if (e.target === surfaceRef.current) onSelect(null);
      return;
    }
    e.preventDefault();
    const origin = clientToCell(e.clientX, e.clientY);
    const setBoth = (d: Draft) => {
      draftRef.current = d;
      setDraft(d);
    };
    setBoth({ posX: origin.x, posY: origin.y, ancho: 1, alto: 1 });

    const onMove = (ev: PointerEvent) => {
      const cc = clientToCell(ev.clientX, ev.clientY);
      setBoth({
        posX: Math.min(origin.x, cc.x),
        posY: Math.min(origin.y, cc.y),
        ancho: Math.abs(cc.x - origin.x) + 1,
        alto: Math.abs(cc.y - origin.y) + 1,
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const d = draftRef.current;
      if (d) onCreateElemento({ tipo: herramienta, ...d });
      setBoth(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dibujando = editando && herramienta !== 'seleccionar';

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden rounded-lg border border-gray-200">
      <DndContext
        sensors={sensors}
        modifiers={[snapToGrid]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={surfaceRef}
          onPointerDown={onSurfacePointerDown}
          className="relative bg-white touch-none"
          style={{
            width: COLS * cell,
            height: ROWS * cell,
            backgroundImage:
              'linear-gradient(to right, #eef0f3 1px, transparent 1px), linear-gradient(to bottom, #eef0f3 1px, transparent 1px)',
            backgroundSize: `${cell}px ${cell}px`,
            cursor: dibujando ? 'crosshair' : 'default',
          }}
        >
          {elementos.map((el) => (
            <ElementoNode
              key={el.id}
              elemento={el}
              modo={modo}
              cell={cell}
              puedeArrastrar={puedeArrastrar}
              seleccionado={seleccion?.tipo === 'elemento' && seleccion.id === el.id}
              onResizePointerDown={(e) => beginResize(e, 'elemento', el)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ tipo: 'elemento', id: el.id });
              }}
            />
          ))}

          {mesas.map((mesa) => (
            <MesaNode
              key={mesa.id}
              mesa={mesa}
              modo={modo}
              cell={cell}
              puedeArrastrar={puedeArrastrar}
              seleccionada={seleccion?.tipo === 'mesa' && seleccion.id === mesa.id}
              ocupada={!!mesa.ocupada}
              onResizePointerDown={(e) => beginResize(e, 'mesa', mesa)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ tipo: 'mesa', id: mesa.id });
              }}
            />
          ))}

          {/* Vista previa mientras se dibuja un elemento */}
          {draft && (
            <div
              className="absolute bg-blue-400/30 border-2 border-dashed border-blue-500 rounded-sm pointer-events-none"
              style={{
                left: draft.posX * cell,
                top: draft.posY * cell,
                width: draft.ancho * cell,
                height: draft.alto * cell,
              }}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
