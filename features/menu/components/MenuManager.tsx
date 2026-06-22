'use client';

import { useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  Search,
  Utensils,
  MoreVertical,
  Pencil,
  Copy,
  CircleSlash,
  CircleCheck,
  Trash2,
} from 'lucide-react';
import { useCategorias, useEliminarCategoria } from '@/features/menu/hooks/useCategorias';
import {
  useProductos,
  useEliminarProducto,
  useCambiarDisponibilidad,
  useDuplicarProducto,
} from '@/features/menu/hooks/useProductos';
import { useAdicionales } from '@/features/menu/hooks/useAdicionales';
import { useVariantes } from '@/features/menu/hooks/useVariantes';
import type { CategoriaMenu, ProductoMenu, Adicional, Variante } from '@/features/menu/types';
import { hasPermission, type RoleType } from '@/features/authorization/roles';
import { formatPeso } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Switch } from '@/shared/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { ProductoDialog } from './ProductoDialog';
import { NuevaCategoriaDialog } from './NuevaCategoriaDialog';
import { ImportarDialog } from './ImportarDialog';

type Filtro = 'todos' | 'disponibles' | 'agotados';

export function MenuManager({
  categorias: initialCategorias = [],
  productos: initialProductos = [],
  adicionales: initialAdicionales = [],
  variantes: initialVariantes = [],
  userRole,
}: {
  categorias?: CategoriaMenu[];
  productos?: ProductoMenu[];
  adicionales?: Adicional[];
  variantes?: Variante[];
  userRole: string;
}) {
  // Estado de servidor (TanStack Query) con updates optimistas
  const { data: categorias = [] } = useCategorias(initialCategorias);
  const { data: productos = [] } = useProductos(initialProductos);
  const { data: adicionales = [] } = useAdicionales(initialAdicionales);
  const { data: variantes = [] } = useVariantes(initialVariantes);
  const eliminarCategoria = useEliminarCategoria();
  const eliminarProducto = useEliminarProducto();
  const cambiarDisponibilidad = useCambiarDisponibilidad();
  const duplicarProducto = useDuplicarProducto();

  const role = userRole as RoleType;
  const canManage = hasPermission(role, 'canManageMenu');
  const canManagePrices = hasPermission(role, 'canManagePrices');

  // Filtros de la vista
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Modales
  const [productoDialogOpen, setProductoDialogOpen] = useState(false);
  const [productoTarget, setProductoTarget] = useState<{
    mode: 'crear' | 'editar';
    producto?: ProductoMenu;
  }>({ mode: 'crear' });
  const [dialogKey, setDialogKey] = useState(0);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [importarDialogOpen, setImportarDialogOpen] = useState(false);

  const abrirCrear = () => {
    setProductoTarget({ mode: 'crear' });
    setDialogKey((k) => k + 1);
    setProductoDialogOpen(true);
  };
  const abrirEditar = (producto: ProductoMenu) => {
    setProductoTarget({ mode: 'editar', producto });
    setDialogKey((k) => k + 1);
    setProductoDialogOpen(true);
  };

  const categoriasMap = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias]
  );

  const conteoPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of productos) m.set(p.categoriaId, (m.get(p.categoriaId) ?? 0) + 1);
    return m;
  }, [productos]);

  // Variantes agrupadas por producto: para mostrar "desde $X" en la tabla y
  // alimentar el editor del dialog.
  const variantesPorProducto = useMemo(() => {
    const m = new Map<string, Variante[]>();
    for (const v of variantes) {
      const arr = m.get(v.productoId);
      if (arr) arr.push(v);
      else m.set(v.productoId, [v]);
    }
    return m;
  }, [variantes]);

  const totalAgotados = useMemo(() => productos.filter((p) => !p.activo).length, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoriaActiva !== 'todos' && p.categoriaId !== categoriaActiva) return false;
      if (filtro === 'disponibles' && !p.activo) return false;
      if (filtro === 'agotados' && p.activo) return false;
      if (
        q &&
        !p.nombre.toLowerCase().includes(q) &&
        !(p.descripcion?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [productos, categoriaActiva, filtro, busqueda]);

  const handleToggleDisponible = (producto: ProductoMenu, disponible: boolean) => {
    cambiarDisponibilidad.mutate({ productoId: producto.id, disponible });
  };
  const handleDuplicar = (producto: ProductoMenu) => {
    duplicarProducto.mutate(producto.id);
  };
  const handleEliminar = (producto: ProductoMenu) => {
    if (confirm(`¿Eliminar el producto ${producto.nombre}?`)) {
      eliminarProducto.mutate(producto.id);
    }
  };
  const handleEliminarCategoria = (c: CategoriaMenu) => {
    if (confirm(`¿Eliminar la categoría ${c.nombre}?`)) {
      eliminarCategoria.mutate(c.id);
      if (categoriaActiva === c.id) setCategoriaActiva('todos');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Menú</h1>
          <p className="text-sm text-muted-foreground">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'} en{' '}
            {categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}
            {totalAgotados > 0 && ` · ${totalAgotados} agotado${totalAgotados === 1 ? '' : 's'}`}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportarDialogOpen(true)}>
              <Upload className="size-4" />
              Importar
            </Button>
            <Button onClick={abrirCrear}>
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Rail de categorías */}
        <Card className="h-fit gap-0 py-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Categorías
            </span>
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCategoriaDialogOpen(true)}
                aria-label="Nueva categoría"
              >
                <Plus className="size-4" />
              </Button>
            )}
          </div>
          <ul className="space-y-0.5 p-2">
            <li>
              <CategoriaItem
                nombre="Todos"
                count={productos.length}
                activa={categoriaActiva === 'todos'}
                onSelect={() => setCategoriaActiva('todos')}
              />
            </li>
            {categorias.map((c) => (
              <li key={c.id} className="group/cat relative">
                <CategoriaItem
                  nombre={c.nombre}
                  count={conteoPorCategoria.get(c.id) ?? 0}
                  activa={categoriaActiva === c.id}
                  onSelect={() => setCategoriaActiva(c.id)}
                  ocultarCount={canManage}
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleEliminarCategoria(c)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover/cat:opacity-100 hover:text-destructive"
                    aria-label={`Eliminar ${c.nombre}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {categorias.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No hay categorías todavía.
              </li>
            )}
          </ul>
        </Card>

        {/* Tabla de productos */}
        <Card className="gap-0 py-0">
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto…"
                className="pl-9"
                aria-label="Buscar producto"
              />
            </div>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="disponibles">Disponibles</TabsTrigger>
                <TabsTrigger value="agotados">Agotados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {productosFiltrados.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              {productos.length === 0
                ? 'Todavía no cargaste productos.'
                : 'No hay productos que coincidan con la búsqueda.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Producto</th>
                    <th className="px-4 py-2.5 font-medium">Categoría</th>
                    <th className="px-4 py-2.5 font-medium">Precio</th>
                    <th className="px-4 py-2.5 font-medium">Disponible</th>
                    <th className="w-10 px-4 py-2.5" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => (
                    <ProductoRow
                      key={p.id}
                      producto={p}
                      variantes={variantesPorProducto.get(p.id) ?? []}
                      categoriaNombre={categoriasMap.get(p.categoriaId) ?? 'Sin categoría'}
                      canManage={canManage}
                      onEditar={abrirEditar}
                      onToggle={handleToggleDisponible}
                      onDuplicar={handleDuplicar}
                      onEliminar={handleEliminar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modales */}
      <ProductoDialog
        key={dialogKey}
        open={productoDialogOpen}
        onOpenChange={setProductoDialogOpen}
        mode={productoTarget.mode}
        producto={productoTarget.producto}
        categorias={categorias}
        adicionales={adicionales}
        variantes={variantes}
        canManagePrices={canManagePrices}
        defaultCategoriaId={categoriaActiva !== 'todos' ? categoriaActiva : undefined}
      />
      <NuevaCategoriaDialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen} />
      <ImportarDialog open={importarDialogOpen} onOpenChange={setImportarDialogOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ítem del rail de categorías
// ---------------------------------------------------------------------------

function CategoriaItem({
  nombre,
  count,
  activa,
  onSelect,
  ocultarCount,
}: {
  nombre: string;
  count: number;
  activa: boolean;
  onSelect: () => void;
  ocultarCount?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
        activa ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-muted'
      )}
    >
      <span className="truncate">{nombre}</span>
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums transition-opacity',
          activa ? 'text-accent-foreground/70' : 'text-muted-foreground',
          ocultarCount && 'group-hover/cat:opacity-0'
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fila de producto
// ---------------------------------------------------------------------------

function ProductoRow({
  producto,
  variantes,
  categoriaNombre,
  canManage,
  onEditar,
  onToggle,
  onDuplicar,
  onEliminar,
}: {
  producto: ProductoMenu;
  variantes: Variante[];
  categoriaNombre: string;
  canManage: boolean;
  onEditar: (p: ProductoMenu) => void;
  onToggle: (p: ProductoMenu, disponible: boolean) => void;
  onDuplicar: (p: ProductoMenu) => void;
  onEliminar: (p: ProductoMenu) => void;
}) {
  const disponible = producto.activo;
  // Un producto con variantes no tiene precio base: mostramos "desde $X".
  const precioLabel =
    variantes.length > 0
      ? `desde ${formatPeso(Math.min(...variantes.map((v) => Number(v.precio))))}`
      : formatPeso(producto.precio);
  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              disponible
                ? 'bg-success-subtle text-success-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Utensils className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{producto.nombre}</p>
            {producto.descripcion && (
              <p className="truncate text-xs text-muted-foreground">{producto.descripcion}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-medium">
          {categoriaNombre}
        </Badge>
      </td>
      <td className="px-4 py-3 font-medium tabular-nums whitespace-nowrap">
        {precioLabel}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={disponible}
            onCheckedChange={(v) => onToggle(producto, v)}
            disabled={!canManage}
            className="data-[state=checked]:bg-success"
            aria-label="Disponible"
          />
          <span
            className={cn(
              'text-sm',
              disponible ? 'text-muted-foreground' : 'font-medium text-destructive'
            )}
          >
            {disponible ? 'Sí' : 'Agotado'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones del producto">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onEditar(producto)}>
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicar(producto)}>
                <Copy />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggle(producto, !disponible)}>
                {disponible ? <CircleSlash /> : <CircleCheck />}
                {disponible ? 'Marcar agotado' : 'Marcar disponible'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(producto)}>
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}
