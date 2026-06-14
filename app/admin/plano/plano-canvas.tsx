'use client';

import { useEffect, useRef, useState } from 'react';
import {
  COLS,
  GRID_PX,
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
  onOpenMesa,
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
  onOpenMesa: (mesa: MesaPlano) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const draftRef = useRef<Draft>(null);
  const [scale, setScale] = useState(1);
  const [draft, setDraft] = useState<Draft>(null);

  // Escalado responsivo: el lienzo lógico (COLS x ROWS) se achica para entrar
  // en el ancho disponible, manteniendo coordenadas en unidades de grilla.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const s = Math.min(1, el.clientWidth / (COLS * GRID_PX));
      scaleRef.current = s;
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clientToCell = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const s = scaleRef.current || 1;
    const x = clamp(Math.floor((clientX - rect.left) / s / GRID_PX), 0, COLS - 1);
    const y = clamp(Math.floor((clientY - rect.top) / s / GRID_PX), 0, ROWS - 1);
    return { x, y };
  };

  // Arrastrar / redimensionar una mesa o elemento
  const beginNodeDrag = (
    e: React.PointerEvent,
    kind: 'mesa' | 'elemento',
    node: MesaPlano | ElementoPlanoUI,
    mode: 'move' | 'resize'
  ) => {
    if (modo !== 'editar') return;
    e.preventDefault();
    e.stopPropagation();
    onSelect({ tipo: kind === 'mesa' ? 'mesa' : 'elemento', id: node.id });

    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { posX: node.posX, posY: node.posY, ancho: node.ancho, alto: node.alto };
    const commit = (partial: Partial<MesaPlano & ElementoPlanoUI>) =>
      kind === 'mesa' ? onChangeMesa(node.id, partial) : onChangeElemento(node.id, partial);

    const onMove = (ev: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dGX = Math.round((ev.clientX - startX) / s / GRID_PX);
      const dGY = Math.round((ev.clientY - startY) / s / GRID_PX);
      if (mode === 'move') {
        commit({
          posX: clamp(orig.posX + dGX, 0, COLS - orig.ancho),
          posY: clamp(orig.posY + dGY, 0, ROWS - orig.alto),
        });
      } else {
        commit({
          ancho: clamp(orig.ancho + dGX, 1, COLS - orig.posX),
          alto: clamp(orig.alto + dGY, 1, ROWS - orig.posY),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Dibujar un elemento (pared / barra) arrastrando sobre el fondo
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (modo !== 'editar') return;
    if (herramienta === 'seleccionar') {
      onSelect(null);
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
      const c = clientToCell(ev.clientX, ev.clientY);
      setBoth({
        posX: Math.min(origin.x, c.x),
        posY: Math.min(origin.y, c.y),
        ancho: Math.abs(c.x - origin.x) + 1,
        alto: Math.abs(c.y - origin.y) + 1,
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

  const dibujando = modo === 'editar' && herramienta !== 'seleccionar';

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden rounded-lg border border-gray-200">
      <div
        ref={surfaceRef}
        onPointerDown={onSurfacePointerDown}
        className="absolute top-0 left-0 bg-white touch-none"
        style={{
          width: COLS * GRID_PX,
          height: ROWS * GRID_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundImage:
            'linear-gradient(to right, #eef0f3 1px, transparent 1px), linear-gradient(to bottom, #eef0f3 1px, transparent 1px)',
          backgroundSize: `${GRID_PX}px ${GRID_PX}px`,
          cursor: dibujando ? 'crosshair' : 'default',
        }}
      >
        {elementos.map((el) => (
          <ElementoNode
            key={el.id}
            elemento={el}
            modo={modo}
            seleccionado={seleccion?.tipo === 'elemento' && seleccion.id === el.id}
            onBodyPointerDown={(e) => beginNodeDrag(e, 'elemento', el, 'move')}
            onResizePointerDown={(e) => beginNodeDrag(e, 'elemento', el, 'resize')}
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
            seleccionada={seleccion?.tipo === 'mesa' && seleccion.id === mesa.id}
            ocupada={!!mesa.ocupada}
            onBodyPointerDown={(e) => beginNodeDrag(e, 'mesa', mesa, 'move')}
            onResizePointerDown={(e) => beginNodeDrag(e, 'mesa', mesa, 'resize')}
            onClick={() => onOpenMesa(mesa)}
          />
        ))}

        {/* Vista previa mientras se dibuja un elemento */}
        {draft && (
          <div
            className="absolute bg-blue-400/30 border-2 border-dashed border-blue-500 rounded-sm pointer-events-none"
            style={{
              left: draft.posX * GRID_PX,
              top: draft.posY * GRID_PX,
              width: draft.ancho * GRID_PX,
              height: draft.alto * GRID_PX,
            }}
          />
        )}
      </div>
    </div>
  );
}
