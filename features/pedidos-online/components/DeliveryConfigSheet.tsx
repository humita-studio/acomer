'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCheck,
  Copy,
  ExternalLink,
  Map as MapIcon,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyInput } from '@/shared/ui/money-input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
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
import { actualizarDeliveryConfigAction } from '@/features/pedidos-online/deliveryConfigActions';
import type { DeliveryConfig, AgregadosHasta } from '@/features/pedidos-online/deliveryConfig';
import { ofreceDelivery } from '@/features/pedidos-online/deliveryConfig';
import type { ZonaPoligono } from '@/features/pedidos-online/zonaMapa';
import { ZonaEntregaMapaLazy } from '@/features/pedidos-online/components/ZonaEntregaMapaLazy';
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

/** Sheet para configurar los pedidos online (modalidades, zona y agregados). */
export function DeliveryConfigSheet({
  open,
  onOpenChange,
  initialConfig,
  publicPedirUrl,
  direccionLocal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialConfig: DeliveryConfig;
  publicPedirUrl?: string;
  /** Dirección del local (landing) para centrar el mapa al dibujar. */
  direccionLocal?: string;
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
            direccionLocal={direccionLocal}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Modal grande solo para dibujar/editar la zona en el mapa. */
function ZonaMapaDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  direccionLocal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: ZonaPoligono | null;
  onConfirm: (poly: ZonaPoligono | null) => void;
  direccionLocal?: string;
}) {
  // Borrador local: no pisa la config hasta "Usar esta zona".
  const [draft, setDraft] = useState<ZonaPoligono | null>(value);
  // Remount del mapa cada vez que se abre (evita estado viejo / tamaño 0).
  const [openKey, setOpenKey] = useState(0);
  // Esperar a que el dialog tenga layout antes de montar Leaflet.
  const [mapMounted, setMapMounted] = useState(false);
  // Snapshot de si había zona al abrir (para autoStartDraw, sin races con draft).
  const [startEmpty, setStartEmpty] = useState(!value);

  useEffect(() => {
    if (!open) {
      setMapMounted(false);
      return;
    }
    // Sincronizar borrador con la config actual al abrir.
    setDraft(value);
    setStartEmpty(!value);
    setOpenKey((k) => k + 1);
    // Montar el mapa un frame después: el dialog ya midió altura/ancho.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMapMounted(true));
    });
    // Fallback por si el browser no pinta a tiempo (animación del dialog).
    const t = window.setTimeout(() => setMapMounted(true), 180);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
    // Solo al abrir el modal; no re-sync si `value` cambia estando abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,900px)] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        // Por encima del Sheet de config (también z-50).
        style={{ zIndex: 60 }}
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>Zona de entrega en el mapa</DialogTitle>
          <DialogDescription>
            {draft
              ? 'Tu zona aparece en naranja. Arrastrá los puntos para ajustar, o redibujá desde cero.'
              : 'Marcá al menos 3 puntos alrededor del área donde entregás. Cerrá con doble clic, el primer punto o el botón.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {open && mapMounted ? (
            <ZonaEntregaMapaLazy
              key={openKey}
              mode="edit"
              value={draft}
              onChange={setDraft}
              direccionLocal={direccionLocal}
              height="min(58vh, 520px)"
              autoStartDraw={startEmpty}
            />
          ) : open ? (
            <div className="flex h-[min(58vh,520px)] min-h-[280px] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
              Cargando mapa…
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-row flex-wrap justify-between gap-2 border-t px-5 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => setDraft(null)}
            disabled={!draft}
          >
            Borrar zona
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm(draft);
                onOpenChange(false);
                toast.success(
                  draft ? 'Zona lista. Guardá la configuración para aplicar.' : 'Zona quitada del borrador.',
                );
              }}
            >
              Usar esta zona
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigBody({
  initialConfig,
  publicPedirUrl,
  direccionLocal,
  onClose,
}: {
  initialConfig: DeliveryConfig;
  publicPedirUrl?: string;
  direccionLocal?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(initialConfig.activo);
  const [modo, setModo] = useState<DeliveryConfig['modo']>(initialConfig.modo);
  const [agregadosHasta, setAgregadosHasta] = useState<AgregadosHasta>(initialConfig.agregadosHasta);
  const [zonaEntrega, setZonaEntrega] = useState(initialConfig.zonaEntrega);
  const [zonaPoligono, setZonaPoligono] = useState<ZonaPoligono | null>(
    initialConfig.zonaPoligono,
  );
  const [mapaOpen, setMapaOpen] = useState(false);
  const [costoEnvio, setCostoEnvio] = useState(
    initialConfig.costoEnvio > 0 ? String(initialConfig.costoEnvio) : '',
  );
  const [pedidoMinimo, setPedidoMinimo] = useState(
    initialConfig.pedidoMinimo > 0 ? String(initialConfig.pedidoMinimo) : '',
  );
  const [tiempoEstimadoMin, setTiempoEstimadoMin] = useState(
    initialConfig.tiempoEstimadoMin != null ? String(initialConfig.tiempoEstimadoMin) : '',
  );
  const [copiado, setCopiado] = useState(false);

  const muestraEnvio = ofreceDelivery({ modo });

  const guardar = useMutation({
    mutationFn: async () => {
      const res = await actualizarDeliveryConfigAction({
        activo,
        modo,
        agregadosHasta,
        zonaEntrega,
        zonaPoligono,
        costoEnvio: Number(costoEnvio) || 0,
        pedidoMinimo: Number(pedidoMinimo) || 0,
        tiempoEstimadoMin: tiempoEstimadoMin.trim()
          ? Number(tiempoEstimadoMin)
          : null,
      });
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
          Activá el canal, elegí retiro y/o envío, definí la zona y compartí el link.
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

        {/* Zona y reglas de envío */}
        {muestraEnvio ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Zona de entrega</Label>
              <p className="text-sm text-muted-foreground">
                Definí en el mapa el área donde entregás. El cliente tendrá que marcar su
                ubicación dentro de esa zona al pedir.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMapaOpen(true)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left transition-colors',
                zonaPoligono
                  ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl',
                  zonaPoligono ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <MapIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                {zonaPoligono ? (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <CheckCircle2 className="size-4 text-primary" aria-hidden />
                      Zona dibujada
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Tocá para editar o arrastrar los puntos en el mapa
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-sm font-semibold">Dibujar zona en el mapa</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {direccionLocal
                        ? `Se centra cerca de: ${direccionLocal}`
                        : 'Abrí el mapa y marcá el área de entrega'}
                    </span>
                  </>
                )}
              </span>
              <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            <div className="space-y-1.5">
              <Label htmlFor="zona-texto" className="text-sm font-medium">
                Descripción de la zona (opcional)
              </Label>
              <Textarea
                id="zona-texto"
                value={zonaEntrega}
                onChange={(e) => setZonaEntrega(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ej: Palermo, Villa Crespo y alrededores"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="costo-envio" className="text-sm font-medium">
                  Costo de envío ($)
                </Label>
                <MoneyInput
                  id="costo-envio"
                  value={costoEnvio}
                  onValueChange={setCostoEnvio}
                  placeholder="0 = gratis"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pedido-minimo" className="text-sm font-medium">
                  Pedido mínimo ($)
                </Label>
                <MoneyInput
                  id="pedido-minimo"
                  value={pedidoMinimo}
                  onValueChange={setPedidoMinimo}
                  placeholder="0 = sin mínimo"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tiempo-estimado" className="text-sm font-medium">
                Tiempo estimado (minutos)
              </Label>
              <Input
                id="tiempo-estimado"
                type="number"
                inputMode="numeric"
                min={5}
                max={1440}
                step={5}
                value={tiempoEstimadoMin}
                onChange={(e) => setTiempoEstimadoMin(e.target.value)}
                placeholder="Ej: 45 (opcional)"
              />
              <p className="text-xs text-muted-foreground">
                Se usa como referencia de llegada/listo. Vacío = no se muestra.
              </p>
            </div>
          </div>
        ) : null}

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

      <ZonaMapaDialog
        open={mapaOpen}
        onOpenChange={setMapaOpen}
        value={zonaPoligono}
        onConfirm={setZonaPoligono}
        direccionLocal={direccionLocal}
      />
    </>
  );
}
