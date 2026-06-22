'use client';

import { MoreVertical, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  type Promocion,
  PROMO_ALCANCE_LABEL,
  PROMO_DIAS,
  promoTipoBadge,
} from '@/features/promociones/promociones';

/** Resumen corto de las condiciones para la tabla. */
function condicionResumen(p: Promocion): string {
  const c = p.condiciones || {};
  const partes: string[] = [];
  if (c.soloEfectivo || (c.metodosPago?.length === 1 && c.metodosPago[0] === 'efectivo')) {
    partes.push('Pago en efectivo');
  } else if (c.metodosPago?.length) {
    partes.push(c.metodosPago.map((m) => (m === 'mercado_pago' ? 'MP' : m)).join('/'));
  }
  if (c.dias?.length) {
    partes.push(c.dias.map((d) => PROMO_DIAS.find((x) => x.value === d)?.label ?? d).join(''));
  }
  if (c.horaDesde && c.horaHasta) partes.push(`${c.horaDesde}–${c.horaHasta}`);
  if (c.montoMinimo) partes.push(`min $${c.montoMinimo}`);
  return partes.join(' · ') || 'Sin condiciones';
}

/** Tabla de promociones con menú de acciones por fila. */
export function PromocionesTabla({
  promos,
  emptyMessage,
  onEditar,
  onToggleEstado,
  toggleEstadoPending,
  onEliminar,
}: {
  promos: Promocion[];
  emptyMessage: string;
  onEditar: (p: Promocion) => void;
  onToggleEstado: (p: Promocion) => void;
  toggleEstadoPending: boolean;
  onEliminar: (p: Promocion) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden grid-cols-[1.6fr_1.4fr_1fr_0.8fr_40px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Promoción</span>
        <span>Condición</span>
        <span>Alcance</span>
        <span>Estado</span>
        <span />
      </div>

      {promos.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      ) : (
        promos.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-1 items-center gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1.6fr_1.4fr_1fr_0.8fr_40px] sm:gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{p.nombre}</span>
              <Badge variant="secondary" className="shrink-0">
                {promoTipoBadge(p.tipo, p.valor)}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">{condicionResumen(p)}</span>
            <span className="text-sm text-muted-foreground">{PROMO_ALCANCE_LABEL[p.alcance]}</span>
            <span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  p.activa
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    p.activa ? 'bg-emerald-500' : 'bg-muted-foreground'
                  }`}
                />
                {p.activa ? 'Activa' : 'Pausada'}
              </span>
            </span>
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditar(p)}>
                    <Pencil className="size-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onToggleEstado(p)}
                    disabled={toggleEstadoPending}
                  >
                    {p.activa ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {p.activa ? 'Pausar' : 'Activar'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onEliminar(p)}>
                    <Trash2 className="size-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
