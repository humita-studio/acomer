'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  COLS,
  GRID_PX,
  LINE_THICKNESS,
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
const round2 = (n: number) => Math.round(n * 100) / 100;

// Geometría de una pared dibujada como línea A→B: un rectángulo fino rotado
// cuyo centro cae sobre el medio de la línea.
function lineaARect(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  return { posX: cx - len / 2, posY: cy - LINE_THICKNESS / 2, ancho: len, alto: LINE_THICKNESS, rot };
}

type Draft = { posX: number; posY: number; ancho: number; alto: number; rot: number } | null;

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
  onCreateElemento: (rect: {
    tipo: Herramienta;
    posX: number;
    posY: number;
    ancho: number;
    alto: number;
    rotacion?: number;
  }) => void;
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

  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { kind: 'mesa' | 'elemento' } | undefined;
    if (d) onSelect({ tipo: d.kind, id: String(e.active.id) });
  };

  // Colocación libre: la posición final es el delta exacto (sin snap a la grilla).
  const handleDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as
      | { kind: 'mesa' | 'elemento'; posX: number; posY: number; ancho: number; alto: number }
      | undefined;
    if (!d) return;
    const dx = e.delta.x / cell;
    const dy = e.delta.y / cell;
    if (!dx && !dy) return;
    const posX = round2(clamp(d.posX + dx, 0, COLS - d.ancho));
    const posY = round2(clamp(d.posY + dy, 0, ROWS - d.alto));
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
    const minSize = kind === 'mesa' ? 0.5 : 0.2;
    const commit = (partial: Partial<MesaPlano & ElementoPlanoUI>) =>
      kind === 'mesa' ? onChangeMesa(node.id, partial) : onChangeElemento(node.id, partial);

    const onMove = (ev: PointerEvent) => {
      const dGX = (ev.clientX - startX) / c;
      const dGY = (ev.clientY - startY) / c;
      commit({
        ancho: round2(clamp(orig.ancho + dGX, minSize, COLS - orig.posX)),
        alto: round2(clamp(orig.alto + dGY, minSize, ROWS - orig.posY)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Punto (fraccional) del lienzo a partir de coordenadas de pantalla
  const clientToPoint = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const c = cellRef.current || GRID_PX;
    return {
      x: clamp((clientX - rect.left) / c, 0, COLS),
      y: clamp((clientY - rect.top) / c, 0, ROWS),
    };
  };

  // Dibujar un elemento (pared / barra como rectángulo, o pared como línea)
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (modo !== 'editar') return;
    if (herramienta === 'seleccionar') {
      if (e.target === surfaceRef.current) onSelect(null);
      return;
    }
    e.preventDefault();
    const origin = clientToPoint(e.clientX, e.clientY);
    const esLinea = herramienta === 'linea';
    const setBoth = (d: Draft) => {
      draftRef.current = d;
      setDraft(d);
    };
    setBoth({ posX: origin.x, posY: origin.y, ancho: 0, alto: 0, rot: 0 });

    const onMove = (ev: PointerEvent) => {
      const p = clientToPoint(ev.clientX, ev.clientY);
      if (esLinea) {
        setBoth(lineaARect(origin.x, origin.y, p.x, p.y));
      } else {
        setBoth({
          posX: Math.min(origin.x, p.x),
          posY: Math.min(origin.y, p.y),
          ancho: Math.abs(p.x - origin.x),
          alto: Math.abs(p.y - origin.y),
          rot: 0,
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const d = draftRef.current;
      // Ignorar trazos demasiado chicos (clicks accidentales)
      const tamanio = esLinea ? d?.ancho ?? 0 : Math.max(d?.ancho ?? 0, d?.alto ?? 0);
      if (d && tamanio >= 0.4) {
        onCreateElemento({
          tipo: herramienta,
          posX: d.posX,
          posY: d.posY,
          ancho: d.ancho,
          alto: d.alto,
          rotacion: d.rot,
        });
      }
      setBoth(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dibujando = editando && herramienta !== 'seleccionar';

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/20">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={surfaceRef}
          onPointerDown={onSurfacePointerDown}
          className="relative touch-none bg-card"
          style={{
            width: COLS * cell,
            height: ROWS * cell,
            // Grilla tenue, sólo como guía mientras se edita
            backgroundImage: editando
              ? 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)'
              : undefined,
            backgroundSize: editando ? `${cell}px ${cell}px` : undefined,
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

          {/* Vista previa mientras se dibuja */}
          {draft && (
            <div
              className="absolute bg-blue-400/30 border-2 border-dashed border-blue-500 rounded-sm pointer-events-none"
              style={{
                left: draft.posX * cell,
                top: draft.posY * cell,
                width: draft.ancho * cell,
                height: draft.alto * cell,
                transform: draft.rot ? `rotate(${draft.rot}deg)` : undefined,
              }}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
