'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreVertical, Pencil, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import {
  listarPromocionesAction,
  crearPromocionAction,
  actualizarPromocionAction,
  togglePromocionAction,
  eliminarPromocionAction,
} from '@/features/promociones/promociones-actions';
import {
  type Promocion,
  type PromocionInput,
  type PromoTipo,
  type PromoAlcance,
  type PromoCanal,
  type PromoMetodoPago,
  PROMO_CANALES,
  PROMO_CANAL_LABEL,
  PROMO_ALCANCE_LABEL,
  PROMO_TIPO_LABEL,
  promoTipoBadge,
} from '@/features/promociones/promociones';

type Cat = { id: string; nombre: string };
type Prod = { id: string; nombre: string; categoriaId: string };
type Filtro = 'todas' | 'activas' | 'pausadas';

const DIAS: { label: string; value: number }[] = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'X', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];
const METODOS: { label: string; value: PromoMetodoPago }[] = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta', value: 'tarjeta' },
  { label: 'Mercado Pago', value: 'mercado_pago' },
];

const EMPTY_FORM: PromocionInput = {
  nombre: '',
  tipo: 'porcentaje',
  valor: 10,
  alcance: 'pedido',
  targetIds: [],
  condiciones: {},
  vigenteDesde: null,
  vigenteHasta: null,
  activa: true,
  prioridad: 0,
};

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

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
    partes.push(c.dias.map((d) => DIAS.find((x) => x.value === d)?.label ?? d).join(''));
  }
  if (c.horaDesde && c.horaHasta) partes.push(`${c.horaDesde}–${c.horaHasta}`);
  if (c.montoMinimo) partes.push(`min $${c.montoMinimo}`);
  return partes.join(' · ') || 'Sin condiciones';
}

function ChipButton({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function PromocionesManager({
  initialPromos,
  categorias,
  productos,
}: {
  initialPromos: Promocion[];
  categorias: Cat[];
  productos: Prod[];
}) {
  const qc = useQueryClient();
  const { data: promos = [] } = useQuery({
    queryKey: ['promociones'],
    queryFn: async () => {
      const res = await listarPromocionesAction();
      return res.promociones;
    },
    initialData: initialPromos,
  });

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromocionInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promocion | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['promociones'] });

  const guardar = useMutation({
    mutationFn: async () => {
      const res = editingId
        ? await actualizarPromocionAction(editingId, form)
        : await crearPromocionAction(form);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Guardado');
      setSheetOpen(false);
      invalidate();
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (p: Promocion) => {
      const res = await togglePromocionAction(p.id, !p.activa);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Listo');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error'),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const res = await eliminarPromocionAction(id);
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Eliminada');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error'),
  });

  const promosFiltradas = useMemo(
    () =>
      promos.filter((p) =>
        filtro === 'todas' ? true : filtro === 'activas' ? p.activa : !p.activa,
      ),
    [promos, filtro],
  );

  const activasCount = promos.filter((p) => p.activa).length;

  const openNueva = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setSheetOpen(true);
  };
  const openEditar = (p: Promocion) => {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      valor: p.valor,
      alcance: p.alcance,
      targetIds: [...p.targetIds],
      condiciones: { ...p.condiciones },
      vigenteDesde: p.vigenteDesde,
      vigenteHasta: p.vigenteHasta,
      activa: p.activa,
      prioridad: p.prioridad,
    });
    setFormError(null);
    setSheetOpen(true);
  };

  const updateCond = (partial: Partial<PromocionInput['condiciones']>) =>
    setForm((f) => ({ ...f, condiciones: { ...f.condiciones, ...partial } }));

  const setTipo = (t: PromoTipo) =>
    setForm((f) => {
      let alcance = f.alcance;
      if (t === 'combo') alcance = 'producto';
      if (t === '2x1' && alcance === 'pedido') alcance = 'producto';
      return { ...f, tipo: t, alcance, valor: t === '2x1' ? 0 : f.valor };
    });
  const setAlcance = (a: PromoAlcance) => setForm((f) => ({ ...f, alcance: a, targetIds: [] }));

  // Qué targets mostrar en el form
  const mostrarProductos = form.tipo === 'combo' || form.alcance === 'producto';
  const mostrarCategorias = form.tipo !== 'combo' && form.alcance === 'categoria';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {(['todas', 'activas', 'pausadas'] as Filtro[]).map((f) => (
          <ChipButton key={f} active={filtro === f} onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : f === 'activas' ? 'Activas' : 'Pausadas'}
          </ChipButton>
        ))}
        <span className="ml-1 text-sm text-muted-foreground">
          {activasCount} activa{activasCount === 1 ? '' : 's'} de {promos.length}
        </span>
        <div className="ml-auto">
          <Button onClick={openNueva}>
            <Plus className="size-4" />
            Nueva promoción
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[1.6fr_1.4fr_1fr_0.8fr_40px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Promoción</span>
          <span>Condición</span>
          <span>Alcance</span>
          <span>Estado</span>
          <span />
        </div>

        {promosFiltradas.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No hay promociones {filtro !== 'todas' ? `(${filtro})` : 'todavía'}. Creá la primera con
            “Nueva promoción”.
          </div>
        ) : (
          promosFiltradas.map((p) => (
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
                    <DropdownMenuItem onClick={() => openEditar(p)}>
                      <Pencil className="size-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => cambiarEstado.mutate(p)}
                      disabled={cambiarEstado.isPending}
                    >
                      {p.activa ? <Pause className="size-4" /> : <Play className="size-4" />}
                      {p.activa ? 'Pausar' : 'Activar'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
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

      {/* Sheet crear / editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{editingId ? 'Editar promoción' : 'Nueva promoción'}</SheetTitle>
            <SheetDescription>Definí el descuento y cuándo aplica.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
            <div className="space-y-2">
              <Label htmlFor="promo-nombre">Nombre</Label>
              <Input
                id="promo-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Descuento en efectivo"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setTipo(v as PromoTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROMO_TIPO_LABEL) as PromoTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {PROMO_TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.tipo !== '2x1' && (
                <div className="space-y-2">
                  <Label htmlFor="promo-valor">
                    {form.tipo === 'porcentaje'
                      ? 'Descuento (%)'
                      : form.tipo === 'combo'
                        ? 'Precio del combo'
                        : 'Descuento ($)'}
                  </Label>
                  <Input
                    id="promo-valor"
                    type="number"
                    min={0}
                    value={form.valor}
                    onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
                  />
                </div>
              )}
            </div>

            {form.tipo !== 'combo' && (
              <div className="space-y-2">
                <Label>Aplicar a</Label>
                <Select value={form.alcance} onValueChange={(v) => setAlcance(v as PromoAlcance)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.tipo !== '2x1' && <SelectItem value="pedido">Todo el pedido</SelectItem>}
                    <SelectItem value="categoria">Categoría</SelectItem>
                    <SelectItem value="producto">Producto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(mostrarProductos || mostrarCategorias) && (
              <div className="space-y-2">
                <Label>
                  {form.tipo === 'combo'
                    ? 'Productos del combo (elegí 2 o más)'
                    : mostrarProductos
                      ? 'Productos'
                      : 'Categorías'}
                </Label>
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">
                  {(mostrarProductos ? productos : categorias).map((item) => (
                    <ChipButton
                      key={item.id}
                      active={form.targetIds.includes(item.id)}
                      onClick={() =>
                        setForm((f) => ({ ...f, targetIds: toggle(f.targetIds, item.id) }))
                      }
                    >
                      {item.nombre}
                    </ChipButton>
                  ))}
                  {(mostrarProductos ? productos : categorias).length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No hay {mostrarProductos ? 'productos' : 'categorías'} cargados.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Condiciones (opcional)
              </p>

              <div className="space-y-2">
                <Label className="text-xs">Método de pago</Label>
                <div className="flex flex-wrap gap-2">
                  {METODOS.map((m) => (
                    <ChipButton
                      key={m.value}
                      active={(form.condiciones.metodosPago ?? []).includes(m.value)}
                      onClick={() =>
                        updateCond({
                          metodosPago: toggle(form.condiciones.metodosPago ?? [], m.value),
                        })
                      }
                    >
                      {m.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Días</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => (
                    <ChipButton
                      key={d.value}
                      active={(form.condiciones.dias ?? []).includes(d.value)}
                      onClick={() =>
                        updateCond({ dias: toggle(form.condiciones.dias ?? [], d.value) })
                      }
                      className="w-9 justify-center px-0 text-center"
                    >
                      {d.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="time"
                    value={form.condiciones.horaDesde ?? ''}
                    onChange={(e) => updateCond({ horaDesde: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="time"
                    value={form.condiciones.horaHasta ?? ''}
                    onChange={(e) => updateCond({ horaHasta: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Canal</Label>
                <div className="flex flex-wrap gap-2">
                  {PROMO_CANALES.map((c: PromoCanal) => (
                    <ChipButton
                      key={c}
                      active={(form.condiciones.canales ?? []).includes(c)}
                      onClick={() =>
                        updateCond({ canales: toggle(form.condiciones.canales ?? [], c) })
                      }
                    >
                      {PROMO_CANAL_LABEL[c]}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Monto mínimo del pedido</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sin mínimo"
                  value={form.condiciones.montoMinimo ?? ''}
                  onChange={(e) =>
                    updateCond({ montoMinimo: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vigente desde</Label>
                <Input
                  type="date"
                  value={form.vigenteDesde ? form.vigenteDesde.slice(0, 10) : ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigenteDesde: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="date"
                  value={form.vigenteHasta ? form.vigenteHasta.slice(0, 10) : ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigenteHasta: e.target.value || null }))
                  }
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium">Activa</span>
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={form.activa}
                onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
              />
            </label>

            {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar promoción'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirmar eliminar */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar la promoción?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `“${deleteTarget.nombre}” se borra para siempre. ` : ''}
              Si solo querés dejar de usarla, mejor pausala.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={eliminar.isPending}
              onClick={() => deleteTarget && eliminar.mutate(deleteTarget.id)}
            >
              {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
