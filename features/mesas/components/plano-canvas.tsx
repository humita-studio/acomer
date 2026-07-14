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
  FINE_STEP,
  GRID_PX,
  LINE_THICKNESS,
  MESA_DEFAULT_ALTO,
  MESA_DEFAULT_ANCHO,
  MIN_CELL,
  ROWS,
  lineaARect,
  normalizeDeg,
  round2,
  snapAngle,
  snapLineEnd,
  snapTo,
  type ElementoPlanoUI,
  type Herramienta,
  type MesaPlano,
  type Modo,
  type Seleccion,
} from './plano-types';
import { MesaNode } from './mesa-node';
import { ElementoNode } from './elemento-node';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

type Draft = { posX: number; posY: number; ancho: number; alto: number; rot: number } | null;

export function PlanoCanvas({
  mesas,
  elementos,
  modo,
  herramienta,
  seleccion,
  snapEnabled = true,
  mozoLabel,
  onChangeMesa,
  onChangeElemento,
  onSelect,
  onCreateElemento,
  onPlaceMesa,
}: {
  mesas: MesaPlano[];
  elementos: ElementoPlanoUI[];
  modo: Modo;
  herramienta: Herramienta;
  seleccion: Seleccion | null;
  snapEnabled?: boolean;
  mozoLabel?: (userId: string | null | undefined) => string | null;
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
  /** Click con herramienta Mesa: coloca en (posX, posY) esquina superior-izquierda. */
  onPlaceMesa?: (pos: { posX: number; posY: number }) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef(GRID_PX);
  const draftRef = useRef<Draft>(null);
  const [cell, setCell] = useState(GRID_PX);
  const [draft, setDraft] = useState<Draft>(null);
  // Ghost de mesa al pasar el mouse con la herramienta Mesa activa.
  const [ghostMesa, setGhostMesa] = useState<{ x: number; y: number } | null>(null);

  const editando = modo === 'editar';
  const puedeArrastrar = editando && herramienta === 'seleccionar';
  // Pared y línea = trazo A→B (natural). Barra = rectángulo.
  const dibujandoTrazo =
    editando && (herramienta === 'pared' || herramienta === 'linea');
  const dibujandoBarra = editando && herramienta === 'barra';
  const dibujandoElemento = dibujandoTrazo || dibujandoBarra;
  const colocandoMesa = editando && herramienta === 'mesa';

  const align = (n: number) => (snapEnabled ? snapTo(n) : round2(n));

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

  const handleDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as
      | { kind: 'mesa' | 'elemento'; posX: number; posY: number; ancho: number; alto: number }
      | undefined;
    if (!d) return;
    const dx = e.delta.x / cell;
    const dy = e.delta.y / cell;
    if (!dx && !dy) return;
    const posX = align(clamp(d.posX + dx, 0, COLS - d.ancho));
    const posY = align(clamp(d.posY + dy, 0, ROWS - d.alto));
    if (d.kind === 'mesa') onChangeMesa(String(e.active.id), { posX, posY });
    else onChangeElemento(String(e.active.id), { posX, posY });
  };

  const beginResize = (
    e: React.PointerEvent,
    kind: 'mesa' | 'elemento',
    node: MesaPlano | ElementoPlanoUI,
  ) => {
    if (modo !== 'editar') return;
    e.preventDefault();
    onSelect({ tipo: kind, id: node.id });
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { posX: node.posX, posY: node.posY, ancho: node.ancho, alto: node.alto };
    const c = cellRef.current || GRID_PX;
    const minSize = kind === 'mesa' ? 0.5 : 0.15;
    const commit = (partial: Partial<MesaPlano & ElementoPlanoUI>) =>
      kind === 'mesa' ? onChangeMesa(node.id, partial) : onChangeElemento(node.id, partial);

    // Resize en espacio local del nodo (respeta rotación visual del mouse de forma simple:
    // proyectamos el delta en ejes de pantalla; suficiente para uso diario).
    const onMove = (ev: PointerEvent) => {
      const dGX = (ev.clientX - startX) / c;
      const dGY = (ev.clientY - startY) / c;
      let ancho = clamp(orig.ancho + dGX, minSize, COLS - orig.posX);
      let alto = clamp(orig.alto + dGY, minSize, ROWS - orig.posY);
      // Paredes finas: redimensionar sobre todo la longitud (ancho), no el grosor.
      if (kind === 'elemento' && (node as ElementoPlanoUI).tipo === 'pared' && orig.alto <= 0.5) {
        alto = orig.alto;
      }
      if (snapEnabled !== ev.shiftKey) {
        // snap on y sin Shift, o snap off con Shift → snapea
        ancho = Math.max(minSize, snapTo(ancho));
        if (!(kind === 'elemento' && (node as ElementoPlanoUI).tipo === 'pared' && orig.alto <= 0.5)) {
          alto = Math.max(minSize, snapTo(alto));
        }
      } else {
        ancho = round2(ancho);
        alto = round2(alto);
      }
      commit({ ancho, alto });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Rotación libre arrastrando el handle. Shift fuerza snap a 15°. Sin Shift: libre o 15° si snap de grilla está on. */
  const beginRotate = (
    e: React.PointerEvent,
    kind: 'mesa' | 'elemento',
    node: MesaPlano | ElementoPlanoUI,
  ) => {
    if (modo !== 'editar') return;
    e.preventDefault();
    e.stopPropagation();
    onSelect({ tipo: kind, id: node.id });

    const surface = surfaceRef.current?.getBoundingClientRect();
    if (!surface) return;
    const c = cellRef.current || GRID_PX;
    const cx = surface.left + (node.posX + node.ancho / 2) * c;
    const cy = surface.top + (node.posY + node.alto / 2) * c;
    const startPointerAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    const origRot = node.rotacion ?? 0;

    const commit = (rotacion: number) =>
      kind === 'mesa'
        ? onChangeMesa(node.id, { rotacion })
        : onChangeElemento(node.id, { rotacion });

    const onMove = (ev: PointerEvent) => {
      const pointerAngle = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
      const raw = origRot + (pointerAngle - startPointerAngle);
      // Libre por defecto; Shift alinea a 15° (como Figma).
      commit(ev.shiftKey ? snapAngle(raw) : normalizeDeg(raw));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clientToPoint = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const c = cellRef.current || GRID_PX;
    return {
      x: clamp((clientX - rect.left) / c, 0, COLS),
      y: clamp((clientY - rect.top) / c, 0, ROWS),
    };
  };

  const mesaTopLeftFromCenter = (cx: number, cy: number) => {
    const w = MESA_DEFAULT_ANCHO;
    const h = MESA_DEFAULT_ALTO;
    let posX = cx - w / 2;
    let posY = cy - h / 2;
    posX = align(clamp(posX, 0, COLS - w));
    posY = align(clamp(posY, 0, ROWS - h));
    return { posX, posY };
  };

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (modo !== 'editar') return;

    if (herramienta === 'seleccionar') {
      if (e.target === surfaceRef.current) onSelect(null);
      return;
    }

    if (herramienta === 'mesa') {
      const target = e.target as HTMLElement;
      if (target !== surfaceRef.current && !target.dataset?.planoSurface) return;
      e.preventDefault();
      const p = clientToPoint(e.clientX, e.clientY);
      const pos = mesaTopLeftFromCenter(p.x, p.y);
      onPlaceMesa?.(pos);
      return;
    }

    e.preventDefault();
    let origin = clientToPoint(e.clientX, e.clientY);
    if (snapEnabled) {
      origin = { x: snapTo(origin.x), y: snapTo(origin.y) };
    }
    const esTrazo = herramienta === 'pared' || herramienta === 'linea';
    const setBoth = (d: Draft) => {
      draftRef.current = d;
      setDraft(d);
    };
    setBoth({ posX: origin.x, posY: origin.y, ancho: 0, alto: 0, rot: 0 });

    const onMove = (ev: PointerEvent) => {
      let p = clientToPoint(ev.clientX, ev.clientY);
      if (esTrazo) {
        // Pared: trazo A→B. Snap de ángulo por defecto (horiz/vert/45); Shift = libre.
        // Si snap de grilla off y sin Shift, aún snapeamos 15° para que no quede chueco sin querer.
        const wantAngleSnap = !ev.shiftKey;
        if (wantAngleSnap) {
          const s = snapLineEnd(origin.x, origin.y, p.x, p.y);
          p = { x: s.x, y: s.y };
        }
        if (snapEnabled) {
          p = { x: snapTo(p.x), y: snapTo(p.y) };
          // Re-snap angle after grid so walls stay clean
          if (wantAngleSnap) {
            const s = snapLineEnd(origin.x, origin.y, p.x, p.y);
            p = { x: s.x, y: s.y };
          }
        }
        setBoth(lineaARect(origin.x, origin.y, p.x, p.y, LINE_THICKNESS));
      } else {
        // Barra: rectángulo
        let posX = Math.min(origin.x, p.x);
        let posY = Math.min(origin.y, p.y);
        let ancho = Math.abs(p.x - origin.x);
        let alto = Math.abs(p.y - origin.y);
        if (snapEnabled) {
          posX = snapTo(posX);
          posY = snapTo(posY);
          ancho = Math.max(FINE_STEP, snapTo(ancho));
          alto = Math.max(FINE_STEP, snapTo(alto));
        }
        setBoth({ posX, posY, ancho, alto, rot: 0 });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const d = draftRef.current;
      const tamanio = esTrazo ? d?.ancho ?? 0 : Math.max(d?.ancho ?? 0, d?.alto ?? 0);
      if (d && tamanio >= 0.35) {
        onCreateElemento({
          tipo: herramienta === 'linea' ? 'pared' : herramienta,
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

  const onSurfacePointerMove = (e: React.PointerEvent) => {
    if (!colocandoMesa) {
      if (ghostMesa) setGhostMesa(null);
      return;
    }
    const p = clientToPoint(e.clientX, e.clientY);
    const pos = mesaTopLeftFromCenter(p.x, p.y);
    setGhostMesa({ x: pos.posX, y: pos.posY });
  };

  const onSurfacePointerLeave = () => {
    if (ghostMesa) setGhostMesa(null);
  };

  const cursorClass = colocandoMesa
    ? 'cursor-copy'
    : dibujandoElemento
      ? 'cursor-crosshair'
      : 'cursor-default';

  const hint = editando
    ? herramienta === 'mesa'
      ? 'Click para colocar mesas. Seguí clickeando para armar el salón.'
      : dibujandoTrazo
        ? 'Arrastrá de punta a punta para trazar una pared. Ángulos a 15° solos · Shift = libre.'
        : dibujandoBarra
          ? 'Arrastrá un rectángulo para la barra / mostrador.'
          : 'Arrastrá para mover · handle superior para rotar · esquina para tamaño · Del borra'
    : null;

  // Grilla suave: puntos en vez de rayas (menos “Excel”, más plano de salón).
  const gridBg =
    editando
      ? {
          backgroundColor: 'var(--card)',
          backgroundImage: `radial-gradient(circle, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
        }
      : {
          backgroundColor: 'color-mix(in oklab, var(--muted) 35%, var(--card))',
        };

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden rounded-xl border border-border shadow-inner"
      >
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div
            ref={surfaceRef}
            data-plano-surface="1"
            onPointerDown={onSurfacePointerDown}
            onPointerMove={onSurfacePointerMove}
            onPointerLeave={onSurfacePointerLeave}
            className={`relative touch-none ${cursorClass}`}
            style={{
              width: COLS * cell,
              height: ROWS * cell,
              ...gridBg,
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
                onRotatePointerDown={(e) => beginRotate(e, 'elemento', el)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (herramienta !== 'seleccionar') return;
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
                mozoNombre={mozoLabel?.(mesa.mozoUserId) ?? null}
                onResizePointerDown={(e) => beginResize(e, 'mesa', mesa)}
                onRotatePointerDown={(e) => beginRotate(e, 'mesa', mesa)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (herramienta !== 'seleccionar') return;
                  onSelect({ tipo: 'mesa', id: mesa.id });
                }}
              />
            ))}

            {ghostMesa && (
              <div
                className="pointer-events-none absolute rounded-[28%] border-2 border-dashed border-primary/55 bg-[#e8d4b8]/50"
                style={{
                  left: ghostMesa.x * cell,
                  top: ghostMesa.y * cell,
                  width: MESA_DEFAULT_ANCHO * cell,
                  height: MESA_DEFAULT_ALTO * cell,
                }}
              />
            )}

            {draft && (
              <div
                className={
                  dibujandoTrazo
                    ? 'pointer-events-none absolute rounded-full bg-primary/45 shadow-sm'
                    : 'pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15'
                }
                style={{
                  left: draft.posX * cell,
                  top: draft.posY * cell,
                  width: Math.max(draft.ancho * cell, 2),
                  height: Math.max(draft.alto * cell, 2),
                  transform: draft.rot ? `rotate(${draft.rot}deg)` : undefined,
                }}
              />
            )}
          </div>
        </DndContext>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
