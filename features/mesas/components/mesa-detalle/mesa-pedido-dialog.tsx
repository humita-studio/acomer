'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getMesaPedidoDataAction } from '@/features/mesas/mesa-pedido-data-action';
import { queryKeys } from '@/shared/query/keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Badge } from '@/shared/ui/badge';
import { MesaPedidoManager } from './mesa-pedido-manager';

type Props = {
  mesaId: string | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modal a pantalla casi completa con el mismo contenido que tenía
 * `/admin/mesas/[mesaId]`: cuenta + carta para agregar ítems.
 */
export function MesaPedidoDialog({ mesaId, tenantId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['mesa-pedido', mesaId] as const,
    queryFn: async () => {
      if (!mesaId) throw new Error('Sin mesa');
      const res = await getMesaPedidoDataAction(mesaId);
      if (!res.success) throw new Error(res.message);
      return res.data;
    },
    enabled: open && !!mesaId,
    staleTime: 15_000,
    retry: 1,
  });

  const handleLiberado = () => {
    onOpenChange(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.plano(tenantId) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,900px)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2.5 pr-8">
            <DialogTitle className="font-display text-xl font-semibold tracking-tight">
              {data?.identificador ?? 'Pedido de mesa'}
            </DialogTitle>
            {data && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                <span className="mr-1.5 size-1.5 rounded-full bg-primary" />
                Ocupada
              </Badge>
            )}
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Tomá o sumá pedidos sin salir del plano de mesas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {(isLoading || (isFetching && !data)) && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              Cargando pedido…
            </div>
          )}

          {isError && !data && (
            <div className="mx-auto max-w-md space-y-3 py-12 text-center">
              <p className="text-sm font-medium text-destructive">
                {error instanceof Error ? error.message : 'No se pudo cargar el pedido'}
              </p>
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => void refetch()}
              >
                Reintentar
              </button>
            </div>
          )}

          {data && (
            <MesaPedidoManager
              mesaId={data.mesaId}
              sesionMesaId={data.sesionId}
              categorias={data.categorias}
              productos={data.productos}
              ticketInicial={data.ticket}
              canLiberar={data.canLiberar}
              onLiberado={handleLiberado}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
