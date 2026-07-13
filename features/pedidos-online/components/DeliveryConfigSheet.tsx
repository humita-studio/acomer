'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { CheckCheck, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { actualizarDeliveryConfigAction } from '@/features/pedidos-online/deliveryConfigActions';
import type { DeliveryConfig, AgregadosHasta } from '@/features/pedidos-online/deliveryConfig';
import { cn } from '@/shared/lib/utils';

const MODO_OPCIONES: { value: DeliveryConfig['modo']; label: string; desc: string }[] = [
  { value: 'ambos', label: 'Retiro y envío', desc: 'Ofrecés las dos modalidades.' },
  { value: 'takeaway', label: 'Solo retiro', desc: 'El cliente solo puede retirar en el local.' },
  { value: 'delivery', label: 'Solo envío', desc: 'El cliente solo puede pedir a domicilio.' },
];

const AGREGADOS_OPCIONES: { value: AgregadosHasta; label: string; desc: string }[] = [
  { value: 'no', label: 'No permitir', desc: 'Una vez confirmado, el pedido queda cerrado.' },
  {
    value: 'preparacion',
    label: 'Hasta que lo empecemos a preparar',
    desc: 'Puede agregar mientras el pedido sigue en "Recibido".',
  },
  {
    value: 'listo',
    label: 'Hasta que esté listo',
    desc: 'Puede agregar mientras se prepara, hasta marcarlo "Listo".',
  },
];

/** Tarjeta-radio reutilizable para las opciones de modalidad / agregados. */
function RadioCard({
  name,
  checked,
  onSelect,
  label,
  desc,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}

/** Sheet para configurar los pedidos online (modalidades y agregados). */
export function DeliveryConfigSheet({
  open,
  onOpenChange,
  initialConfig,
  publicPedirUrl,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialConfig: DeliveryConfig;
  publicPedirUrl?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* El cuerpo se monta recién al abrir, así su estado parte siempre de la
            config guardada y descarta ediciones de una apertura anterior. */}
        {open && (
          <ConfigBody
            initialConfig={initialConfig}
            publicPedirUrl={publicPedirUrl}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ConfigBody({
  initialConfig,
  publicPedirUrl,
  onClose,
}: {
  initialConfig: DeliveryConfig;
  publicPedirUrl?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(initialConfig.activo);
  const [modo, setModo] = useState<DeliveryConfig['modo']>(initialConfig.modo);
  const [agregadosHasta, setAgregadosHasta] = useState<AgregadosHasta>(initialConfig.agregadosHasta);
  const [copiado, setCopiado] = useState(false);

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await actualizarDeliveryConfigAction({ activo, modo, agregadosHasta });
      if (!res.success) throw new Error(res.message);
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Configuración guardada');
      onClose();
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Configuración de pedidos online</SheetTitle>
        <SheetDescription>
          Activá el canal, elegí retiro y/o envío, y compartí el link con tus clientes.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {publicPedirUrl ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">Link público del menú</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{publicPedirUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicPedirUrl);
                    setCopiado(true);
                    toast.success('Link copiado');
                    setTimeout(() => setCopiado(false), 2000);
                  } catch {
                    toast.error('No se pudo copiar');
                  }
                }}
              >
                {copiado ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
              <Button type="button" size="sm" variant="secondary" asChild>
                <a href={publicPedirUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        {/* Pedidos online activos */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4">
          <span>
            <span className="block text-sm font-medium">Pedidos online</span>
            <span className="block text-sm text-muted-foreground">
              Si está apagado, /pedir no toma pedidos (sí se puede ver la carta).
            </span>
          </span>
          <Switch checked={activo} onCheckedChange={setActivo} />
        </label>

        {/* Modalidades */}
        <div className="space-y-2">
          <div>
            <Label className="text-sm font-medium">Modalidades que ofrecés</Label>
            <p className="text-sm text-muted-foreground">
              Qué puede elegir el cliente al finalizar su pedido.
            </p>
          </div>
          {MODO_OPCIONES.map((op) => (
            <RadioCard
              key={op.value}
              name="modo"
              checked={modo === op.value}
              onSelect={() => setModo(op.value)}
              label={op.label}
              desc={op.desc}
            />
          ))}
        </div>

        {/* Agregados después de confirmar */}
        <div className="space-y-2">
          <div>
            <Label className="text-sm font-medium">Agregar productos a un pedido ya hecho</Label>
            <p className="text-sm text-muted-foreground">
              Hasta cuándo el cliente puede sumar productos después de confirmar (y pagar).
            </p>
          </div>
          {AGREGADOS_OPCIONES.map((op) => (
            <RadioCard
              key={op.value}
              name="agregadosHasta"
              checked={agregadosHasta === op.value}
              onSelect={() => setAgregadosHasta(op.value)}
              label={op.label}
              desc={op.desc}
            />
          ))}
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </SheetFooter>
    </>
  );
}
