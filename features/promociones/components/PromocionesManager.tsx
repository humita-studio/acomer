'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  listarPromocionesAction,
  crearPromocionAction,
  actualizarPromocionAction,
  togglePromocionAction,
  eliminarPromocionAction,
} from '@/features/promociones/promocionesActions';
import { type Promocion, type PromocionInput } from '@/features/promociones/promociones';
import { ChipButton } from './ChipButton';
import { PromocionesTabla } from './PromocionesTabla';
import { PromocionFormSheet, type Cat, type Prod } from './PromocionFormSheet';

type Filtro = 'todas' | 'activas' | 'pausadas';

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

  const emptyMessage = `No hay promociones ${
    filtro !== 'todas' ? `(${filtro})` : 'todavía'
  }. Creá la primera con “Nueva promoción”.`;

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

      <PromocionesTabla
        promos={promosFiltradas}
        emptyMessage={emptyMessage}
        onEditar={openEditar}
        onToggleEstado={(p) => cambiarEstado.mutate(p)}
        toggleEstadoPending={cambiarEstado.isPending}
        onEliminar={setDeleteTarget}
      />

      <PromocionFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        categorias={categorias}
        productos={productos}
        formError={formError}
        guardando={guardar.isPending}
        onGuardar={() => guardar.mutate()}
      />

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
