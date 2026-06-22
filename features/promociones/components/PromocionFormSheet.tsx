'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import {
  type PromocionInput,
  type PromoTipo,
  type PromoAlcance,
  type PromoCanal,
  PROMO_CANALES,
  PROMO_CANAL_LABEL,
  PROMO_TIPO_LABEL,
  PROMO_DIAS,
  PROMO_METODOS,
} from '@/features/promociones/promociones';
import { ChipButton } from './ChipButton';

export type Cat = { id: string; nombre: string };
export type Prod = { id: string; nombre: string; categoriaId: string };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Sheet para crear o editar una promoción. */
export function PromocionFormSheet({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  categorias,
  productos,
  formError,
  guardando,
  onGuardar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingId: string | null;
  form: PromocionInput;
  setForm: Dispatch<SetStateAction<PromocionInput>>;
  categorias: Cat[];
  productos: Prod[];
  formError: string | null;
  guardando: boolean;
  onGuardar: () => void;
}) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
                {PROMO_METODOS.map((m) => (
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
                {PROMO_DIAS.map((d) => (
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
                onChange={(e) => setForm((f) => ({ ...f, vigenteDesde: e.target.value || null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={form.vigenteHasta ? form.vigenteHasta.slice(0, 10) : ''}
                onChange={(e) => setForm((f) => ({ ...f, vigenteHasta: e.target.value || null }))}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar promoción'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
