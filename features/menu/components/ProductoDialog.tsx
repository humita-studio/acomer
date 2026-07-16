'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Star, Trash2 } from 'lucide-react';
import {
  useCrearProducto,
  useEditarProducto,
  useModificarPrecioProducto,
  useCambiarDisponibilidad,
} from '@/features/menu/hooks/useProductos';
import {
  useAgregarAdicional,
  useEditarPrecioAdicional,
  useEliminarAdicional,
} from '@/features/menu/hooks/useAdicionales';
import {
  useAgregarVariante,
  useEditarPrecioVariante,
  useEliminarVariante,
  useMarcarVarianteDefault,
} from '@/features/menu/hooks/useVariantes';
import type { CategoriaMenu, ProductoMenu, Adicional, Variante } from '@/features/menu/types';
import { usePrompt } from '@/shared/hooks/use-prompt';
import { formatPeso, parseMontoInput } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyInput } from '@/shared/ui/money-input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { NuevaCategoriaDialog } from './NuevaCategoriaDialog';
import { ProductoImagenField } from './ProductoImagenField';
import { Badge } from '@/shared/ui/badge';

const NUEVA_CATEGORIA_VALUE = '__nueva__';

/** Sugerencias rápidas de alérgenos (el dueño puede sumar otras a mano). */
const ALERGENOS_SUGERIDOS = [
  'gluten',
  'lactosa',
  'huevo',
  'frutos secos',
  'maní',
  'soja',
  'pescado',
  'mariscos',
  'apio',
  'mostaza',
  'sésamo',
  'sulfitos',
];

type StagedAdicional = { tempId: string; nombre: string; precioExtra: number };
type StagedVariante = { tempId: string; nombre: string; precio: number };

const labelCls = 'text-xs font-medium tracking-wide text-muted-foreground uppercase';

export function ProductoDialog({
  open,
  onOpenChange,
  mode,
  producto,
  categorias,
  adicionales,
  variantes,
  canManagePrices,
  defaultCategoriaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'crear' | 'editar';
  producto?: ProductoMenu;
  categorias: CategoriaMenu[];
  adicionales: Adicional[];
  variantes: Variante[];
  canManagePrices: boolean;
  defaultCategoriaId?: string;
}) {
  const esEditar = mode === 'editar' && !!producto;

  const [tab, setTab] = useState<'detalles' | 'variantes' | 'adicionales'>('detalles');
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [categoriaId, setCategoriaId] = useState(
    producto?.categoriaId ?? defaultCategoriaId ?? categorias[0]?.id ?? ''
  );
  const [precio, setPrecio] = useState(
    producto && producto.precio != null ? String(producto.precio) : ''
  );
  const [disponible, setDisponible] = useState(producto?.activo ?? true);
  const [alergenos, setAlergenos] = useState<string[]>(producto?.alergenos ?? []);
  const [alergenoDraft, setAlergenoDraft] = useState('');
  // Toggle de creación: precio único vs. con variantes (presentaciones de precio fijo).
  const [tieneVariantes, setTieneVariantes] = useState(false);
  const [stagedAdicionales, setStagedAdicionales] = useState<StagedAdicional[]>([]);
  const [stagedVariantes, setStagedVariantes] = useState<StagedVariante[]>([]);
  const [precioVarianteDraft, setPrecioVarianteDraft] = useState('');
  const [precioAdicionalDraft, setPrecioAdicionalDraft] = useState('0');
  const [nuevaCategoriaOpen, setNuevaCategoriaOpen] = useState(false);

  const crearProducto = useCrearProducto();
  const editarProducto = useEditarProducto();
  const modificarPrecio = useModificarPrecioProducto();
  const cambiarDisponibilidad = useCambiarDisponibilidad();
  const agregarAdicional = useAgregarAdicional();
  const editarPrecioAdicional = useEditarPrecioAdicional();
  const eliminarAdicional = useEliminarAdicional();
  const agregarVariante = useAgregarVariante();
  const editarPrecioVariante = useEditarPrecioVariante();
  const eliminarVariante = useEliminarVariante();
  const marcarVarianteDefault = useMarcarVarianteDefault();
  const { prompt, promptDialog } = usePrompt();

  const adicionalesDelProducto = esEditar
    ? adicionales.filter((a) => a.productoId === producto!.id)
    : [];
  const variantesDelProducto = esEditar
    ? variantes
        .filter((v) => v.productoId === producto!.id)
        .sort((a, b) => a.orden - b.orden)
    : [];

  // En edición el modo lo determina el dato; en creación, el toggle.
  const usarVariantes = esEditar ? variantesDelProducto.length > 0 : tieneVariantes;

  const cantidadAdicionales = esEditar ? adicionalesDelProducto.length : stagedAdicionales.length;
  const cantidadVariantes = esEditar ? variantesDelProducto.length : stagedVariantes.length;

  // --- Adicionales ---
  const handleAgregarAdicional = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const nombreAd = (data.get('nombre') as string)?.trim();
    if (!nombreAd) return;
    const precioExtra = parseMontoInput(precioAdicionalDraft) ?? 0;
    if (precioExtra < 0) {
      toast.error('Ingresá un precio extra válido (0 o más).');
      return;
    }

    if (esEditar) {
      agregarAdicional.mutate({ productoId: producto!.id, nombre: nombreAd, precioExtra });
    } else {
      setStagedAdicionales((prev) => [...prev, { tempId: crypto.randomUUID(), nombre: nombreAd, precioExtra }]);
    }
    form.reset();
    setPrecioAdicionalDraft('0');
  };

  const handleEditarPrecioAdicional = async (
    id: string,
    nombreAd: string,
    precioActual: number,
  ) => {
    const nuevo = await prompt({
      title: `Precio extra · ${nombreAd}`,
      description: `Actual: ${formatPeso(precioActual)}`,
      label: 'Precio extra ($)',
      defaultValue: String(precioActual),
      inputType: 'money',
      min: 0,
      confirmLabel: 'Guardar',
      validate: (v) => {
        const n = parseMontoInput(v);
        if (n == null || n < 0) return 'Ingresá un precio válido (0 o más).';
        return null;
      },
    });
    if (nuevo === null) return;
    editarPrecioAdicional.mutate({
      modificadorId: id,
      nuevoPrecio: parseMontoInput(nuevo) ?? 0,
    });
  };

  // --- Variantes ---
  const handleAgregarVariante = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const nombreVar = (data.get('nombre') as string)?.trim();
    if (!nombreVar) return;
    const precioVar = parseMontoInput(precioVarianteDraft);
    if (precioVar == null || precioVar <= 0) {
      toast.error('Ingresá un precio válido para la variante.');
      return;
    }

    if (esEditar) {
      agregarVariante.mutate({ productoId: producto!.id, nombre: nombreVar, precio: precioVar });
    } else {
      setStagedVariantes((prev) => [...prev, { tempId: crypto.randomUUID(), nombre: nombreVar, precio: precioVar }]);
    }
    form.reset();
    setPrecioVarianteDraft('');
  };

  const handleEditarPrecioVariante = async (
    id: string,
    nombreVar: string,
    precioActual: number,
  ) => {
    const nuevo = await prompt({
      title: `Precio · ${nombreVar}`,
      description: `Actual: ${formatPeso(precioActual)}`,
      label: 'Precio ($)',
      defaultValue: String(precioActual),
      inputType: 'money',
      min: 0,
      confirmLabel: 'Guardar',
      validate: (v) => {
        const n = parseMontoInput(v);
        if (n == null || n <= 0) return 'Ingresá un precio mayor a 0.';
        return null;
      },
    });
    if (nuevo === null) return;
    editarPrecioVariante.mutate({
      varianteId: id,
      nuevoPrecio: parseMontoInput(nuevo) ?? 0,
    });
  };

  const handleGuardar = () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.error('Ingresá el nombre del producto.');
      return;
    }
    if (!categoriaId) {
      toast.error('Elegí una categoría para el producto.');
      return;
    }

    const precioNum = parseMontoInput(precio) ?? NaN;
    if (!usarVariantes && (!Number.isFinite(precioNum) || precioNum <= 0)) {
      toast.error('Ingresá un precio válido.');
      return;
    }

    const variantesAEnviar = stagedVariantes
      .filter((v) => v.nombre.trim() && v.precio > 0)
      .map((v) => ({ nombre: v.nombre, precio: v.precio }));
    if (!esEditar && usarVariantes && variantesAEnviar.length === 0) {
      toast.error('Agregá al menos una variante con precio.');
      setTab('variantes');
      return;
    }

    const adicionalesAEnviar = stagedAdicionales.map((a) => ({
      nombre: a.nombre,
      precioExtra: a.precioExtra,
    }));

    if (esEditar) {
      editarProducto.mutate({
        productoId: producto!.id,
        nombre: nombreLimpio,
        descripcion: descripcion.trim(),
        categoriaId,
        alergenos,
      });
      if (!usarVariantes && canManagePrices && precioNum !== Number(producto!.precio)) {
        modificarPrecio.mutate({ productoId: producto!.id, nuevoPrecio: precioNum });
      }
      if (disponible !== producto!.activo) {
        cambiarDisponibilidad.mutate({ productoId: producto!.id, disponible });
      }
    } else if (usarVariantes) {
      crearProducto.mutate({
        categoriaId,
        alergenos,
        nombre: nombreLimpio,
        descripcion: descripcion.trim(),
        disponible,
        variantes: variantesAEnviar,
        adicionales: adicionalesAEnviar,
      });
    } else {
      crearProducto.mutate({
        categoriaId,
        nombre: nombreLimpio,
        descripcion: descripcion.trim(),
        precio: precioNum,
        disponible,
        alergenos,
        adicionales: adicionalesAEnviar,
      });
    }

    onOpenChange(false);
  };

  return (
    <>
      {promptDialog}
      <NuevaCategoriaDialog
        open={nuevaCategoriaOpen}
        onOpenChange={setNuevaCategoriaOpen}
        onCreated={(id) => setCategoriaId(id)}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEditar ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {esEditar ? 'Actualizá los datos de este ítem.' : 'Agregá un ítem a tu carta digital.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalles">Detalles</TabsTrigger>
            <TabsTrigger value="variantes">
              Variantes{cantidadVariantes > 0 ? ` · ${cantidadVariantes}` : ''}
            </TabsTrigger>
            <TabsTrigger value="adicionales">
              Adicionales{cantidadAdicionales > 0 ? ` · ${cantidadAdicionales}` : ''}
            </TabsTrigger>
          </TabsList>

          {/* Detalles */}
          <TabsContent value="detalles" className="grid gap-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="producto-nombre" className={labelCls}>
                Nombre
              </Label>
              <Input
                id="producto-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Milanesa"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="producto-descripcion" className={labelCls}>
                Descripción
              </Label>
              <Input
                id="producto-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Con papas fritas"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className={labelCls}>Categoría</Label>
                <Select
                  value={categoriaId}
                  onValueChange={(v) => {
                    if (v === NUEVA_CATEGORIA_VALUE) {
                      setNuevaCategoriaOpen(true);
                      return;
                    }
                    setCategoriaId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                    {categorias.length > 0 && <SelectSeparator />}
                    <SelectItem value={NUEVA_CATEGORIA_VALUE} className="text-primary">
                      <Plus className="size-3.5" />
                      Nueva categoría
                    </SelectItem>
                  </SelectContent>
                </Select>
                {categorias.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Todavía no tenés categorías. Creá una para poder guardar el producto.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="producto-precio" className={labelCls}>
                  Precio
                </Label>
                {usarVariantes ? (
                  <p className="flex h-9 items-center rounded-md border border-dashed border-border-strong px-3 text-xs text-muted-foreground">
                    Por variante
                  </p>
                ) : (
                  <MoneyInput
                    id="producto-precio"
                    value={precio}
                    onValueChange={setPrecio}
                    placeholder="0"
                    disabled={esEditar && !canManagePrices}
                  />
                )}
              </div>
            </div>

            {/* Toggle precio único vs. variantes (solo al crear; al editar lo define el dato) */}
            {!esEditar && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="space-y-0.5 pr-3">
                  <p className="text-sm font-medium">Este plato tiene variantes</p>
                  <p className="text-xs text-muted-foreground">
                    Presentaciones de precio fijo y elección única (ej. Napolitana, A caballo)
                  </p>
                </div>
                <Switch
                  checked={tieneVariantes}
                  onCheckedChange={(v) => {
                    setTieneVariantes(v);
                    if (v) setTab('variantes');
                  }}
                />
              </div>
            )}

            <div
              className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3',
                disponible
                  ? 'border-border bg-muted/30'
                  : 'border-destructive/40 bg-destructive/5',
              )}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {disponible ? 'Disponible para la venta' : 'Agotado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {disponible
                    ? 'Se muestra en la carta de tus clientes'
                    : 'No se ofrece en la carta hasta reactivarlo'}
                </p>
              </div>
              <Switch
                checked={disponible}
                onCheckedChange={setDisponible}
                className="data-[state=checked]:bg-success"
              />
            </div>

            {esEditar ? (
              <ProductoImagenField
                productoId={producto!.id}
                imagenUrl={producto?.imagenUrl}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                La foto se puede subir después de crear el producto (editá el plato).
              </p>
            )}

            <div className="grid gap-2">
              <Label className={labelCls}>Alérgenos</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALERGENOS_SUGERIDOS.map((a) => {
                  const on = alergenos.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() =>
                        setAlergenos((prev) =>
                          on ? prev.filter((x) => x !== a) : [...prev, a],
                        )
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors',
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input
                  value={alergenoDraft}
                  onChange={(e) => setAlergenoDraft(e.target.value)}
                  placeholder="Otro alérgeno…"
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const t = alergenoDraft.trim().toLowerCase();
                    if (!t) return;
                    setAlergenos((prev) => (prev.includes(t) ? prev : [...prev, t]));
                    setAlergenoDraft('');
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const t = alergenoDraft.trim().toLowerCase();
                    if (!t) return;
                    setAlergenos((prev) => (prev.includes(t) ? prev : [...prev, t]));
                    setAlergenoDraft('');
                  }}
                >
                  Sumar
                </Button>
              </div>
              {alergenos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {alergenos.map((a) => (
                    <Badge
                      key={a}
                      variant="secondary"
                      className="cursor-pointer capitalize"
                      onClick={() => setAlergenos((prev) => prev.filter((x) => x !== a))}
                    >
                      {a} ×
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </TabsContent>

          {/* Variantes */}
          <TabsContent value="variantes" className="grid gap-3 pt-4">
            {!usarVariantes ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
                Activá <span className="font-medium">“Este plato tiene variantes”</span> en Detalles
                para cargar presentaciones con precio fijo (ej. Milanesa Napolitana).
              </p>
            ) : (
              <>
                {cantidadVariantes === 0 ? (
                  <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
                    Todavía no agregaste variantes. La primera queda como predeterminada.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {esEditar
                      ? variantesDelProducto.map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  !v.esDefault &&
                                  marcarVarianteDefault.mutate({ productoId: producto!.id, varianteId: v.id })
                                }
                                title={v.esDefault ? 'Predeterminada' : 'Marcar como predeterminada'}
                                className={cn(
                                  'shrink-0 transition-colors',
                                  v.esDefault
                                    ? 'text-warning'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <Star className={cn('size-4', v.esDefault && 'fill-current')} />
                              </button>
                              <span className="truncate text-sm font-medium">{v.nombre}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {formatPeso(v.precio)}
                              </span>
                              {canManagePrices && (
                                <button
                                  type="button"
                                  onClick={() => handleEditarPrecioVariante(v.id, v.nombre, Number(v.precio))}
                                  className="text-sm font-medium text-primary hover:underline"
                                >
                                  Precio
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => eliminarVariante.mutate({ productoId: producto!.id, varianteId: v.id })}
                                disabled={
                                  eliminarVariante.isPending &&
                                  eliminarVariante.variables?.varianteId === v.id
                                }
                                className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                                title="Eliminar variante"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </li>
                        ))
                      : stagedVariantes.map((v, i) => (
                          <li key={v.tempId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <Star
                                className={cn(
                                  'size-4 shrink-0',
                                  i === 0 ? 'fill-current text-warning' : 'text-transparent'
                                )}
                              />
                              <span className="truncate text-sm font-medium">{v.nombre}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {formatPeso(v.precio)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setStagedVariantes((prev) => prev.filter((s) => s.tempId !== v.tempId))
                                }
                                className="text-muted-foreground transition-colors hover:text-destructive"
                                title="Quitar variante"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                  </ul>
                )}

                <form onSubmit={handleAgregarVariante} className="flex flex-col gap-2 sm:flex-row">
                  <Input name="nombre" placeholder="Nueva variante (ej. Napolitana)" className="flex-1" required />
                  <MoneyInput
                    value={precioVarianteDraft}
                    onValueChange={setPrecioVarianteDraft}
                    placeholder="Precio"
                    className="sm:w-36"
                    required
                  />
                  <Button type="submit" variant="secondary" className="sm:w-auto">
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </form>
              </>
            )}
          </TabsContent>

          {/* Adicionales */}
          <TabsContent value="adicionales" className="grid gap-3 pt-4">
            {cantidadAdicionales === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
                Este plato todavía no tiene adicionales. Agregá extras como “Doble carne” o “Sin sal”.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {esEditar
                  ? adicionalesDelProducto.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm font-medium">{a.nombre}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {Number(a.precio) > 0 ? `+${formatPeso(a.precio)}` : 'Sin costo'}
                          </span>
                          {canManagePrices && (
                            <button
                              type="button"
                              onClick={() => handleEditarPrecioAdicional(a.id, a.nombre, Number(a.precio))}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Precio
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => eliminarAdicional.mutate({ productoId: producto!.id, modificadorId: a.id })}
                            disabled={
                              eliminarAdicional.isPending &&
                              eliminarAdicional.variables?.modificadorId === a.id
                            }
                            className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                            title="Eliminar adicional"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))
                  : stagedAdicionales.map((a) => (
                      <li key={a.tempId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm font-medium">{a.nombre}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {a.precioExtra > 0 ? `+${formatPeso(a.precioExtra)}` : 'Sin costo'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setStagedAdicionales((prev) => prev.filter((s) => s.tempId !== a.tempId))}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            title="Quitar adicional"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
              </ul>
            )}

            <form onSubmit={handleAgregarAdicional} className="flex flex-col gap-2 sm:flex-row">
              <Input name="nombre" placeholder="Nuevo adicional (ej. Doble carne)" className="flex-1" required />
              <MoneyInput
                value={precioAdicionalDraft}
                onValueChange={setPrecioAdicionalDraft}
                placeholder="Extra"
                className="sm:w-36"
              />
              <Button type="submit" variant="secondary" className="sm:w-auto">
                <Plus className="size-4" />
                Agregar
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGuardar} className={cn(!nombre.trim() && 'opacity-50')}>
            {esEditar ? 'Guardar cambios' : 'Guardar producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}
