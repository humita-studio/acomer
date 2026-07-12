'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Lock, Printer } from 'lucide-react';
import {
  formatPeso,
  formatHora,
  formatFechaLarga,
} from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  useCajaActual,
  useHistorialCajas,
  useCajaRealtime,
  useAbrirCaja,
  useRegistrarMovimiento,
  useCerrarCaja,
  useDetalleCierre,
} from '@/features/caja/hooks/useCaja';
import type { CajaActual, CajaCerrada, TipoMovimiento } from '@/features/caja/types';
import { CajaHistorial } from '@/features/caja/components/CajaHistorial';

const TIPO_LABEL: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  retiro: 'Retiro',
};

// Clases del chip de cada tipo de movimiento, sobre la base de <Badge>.
const TIPO_BADGE: Record<TipoMovimiento, string> = {
  ingreso: 'bg-success-subtle text-success-foreground',
  egreso: 'bg-destructive/10 text-destructive',
  retiro: 'bg-warning-subtle text-warning-foreground',
};

export function CajaManager({
  initialCaja,
  initialHistorial,
  tenantId,
}: {
  initialCaja: CajaActual | null;
  initialHistorial: CajaCerrada[];
  tenantId: string;
}) {
  const { data: caja } = useCajaActual(tenantId, initialCaja);
  const { data: historial = initialHistorial } = useHistorialCajas(tenantId, initialHistorial);
  useCajaRealtime(tenantId);

  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Caja</h1>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'size-2.5 rounded-full',
                caja ? 'bg-success' : 'bg-muted-foreground/40'
              )}
            />
            <span className="text-muted-foreground">
              {caja
                ? `Caja abierta desde las ${formatHora(caja.abiertaAt)} hs`
                : 'No hay ninguna caja abierta'}
            </span>
          </div>
        </div>
        {caja && (
          <Button onClick={() => setCerrarOpen(true)}>
            <Lock className="size-4" />
            Cerrar caja
          </Button>
        )}
      </div>

      {caja ? (
        <CajaAbierta caja={caja} tenantId={tenantId} />
      ) : (
        <AbrirCajaCard tenantId={tenantId} />
      )}

      <CajaHistorial historial={historial} onSelect={setDetalleId} />

      {caja && (
        <CerrarCajaDialog
          caja={caja}
          tenantId={tenantId}
          open={cerrarOpen}
          onOpenChange={setCerrarOpen}
          onCerrada={(id) => {
            setCerrarOpen(false);
            setDetalleId(id);
          }}
        />
      )}

      <DetalleCierreDialog
        sesionId={detalleId}
        onOpenChange={(open) => !open && setDetalleId(null)}
      />
    </div>
  );
}

/* ------------------------------ Caja abierta ------------------------------ */

function CajaAbierta({ caja, tenantId }: { caja: CajaActual; tenantId: string }) {
  const movimientoMutation = useRegistrarMovimiento(tenantId);

  const [tipoMov, setTipoMov] = useState<TipoMovimiento>('ingreso');
  const [montoMov, setMontoMov] = useState('');
  const [conceptoMov, setConceptoMov] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number(montoMov);
    if (!Number.isFinite(monto) || monto <= 0) return;
    const concepto = conceptoMov.trim();
    movimientoMutation.mutate(
      { cajaId: caja.id, tipo: tipoMov, monto, concepto },
      {
        onSuccess: () => {
          toast.success('Movimiento registrado', {
            description: `${TIPO_LABEL[tipoMov]} · ${formatPeso(monto)}${
              concepto ? ` · ${concepto}` : ''
            }`,
          });
          setMontoMov('');
          setConceptoMov('');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <ResumenCard titulo="Monto inicial" valor={formatPeso(caja.montoInicial)} />
        <ResumenCard titulo="Ventas efectivo" valor={formatPeso(caja.ventasEfectivo)} />
        <ResumenCard titulo="Ingresos" valor={formatPeso(caja.ingresos)} />
        <ResumenCard titulo="Egresos" valor={formatPeso(caja.egresos)} />
        <ResumenCard titulo="Retiros" valor={formatPeso(caja.retiros)} />
        <ResumenCard titulo="Esperado en caja" valor={formatPeso(caja.esperadoEnCaja)} destacado />
      </div>

      <p className="text-sm text-muted-foreground">
        Tarjeta {formatPeso(caja.ventasTarjeta)} · Mercado Pago{' '}
        {formatPeso(caja.ventasMercadoPago)} — no afectan el efectivo en caja
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Registrar movimiento */}
        <Card>
          <CardHeader>
            <CardTitle>Registrar movimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={tipoMov} onValueChange={(v) => setTipoMov(v as TipoMovimiento)}>
                <TabsList className="w-full">
                  <TabsTrigger value="ingreso">Ingreso</TabsTrigger>
                  <TabsTrigger value="egreso">Egreso</TabsTrigger>
                  <TabsTrigger value="retiro">Retiro</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-1.5">
                <Label htmlFor="monto-mov">Monto</Label>
                <MontoInput
                  id="monto-mov"
                  value={montoMov}
                  onChange={setMontoMov}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="concepto-mov">Concepto (opcional)</Label>
                <Input
                  id="concepto-mov"
                  value={conceptoMov}
                  onChange={(e) => setConceptoMov(e.target.value)}
                  placeholder="Ej. compra de insumos"
                />
              </div>

              <Button type="submit" className="w-full" disabled={movimientoMutation.isPending}>
                {movimientoMutation.isPending ? 'Registrando…' : 'Registrar movimiento'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Movimientos del turno */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos del turno</CardTitle>
          </CardHeader>
          <CardContent>
            {caja.movimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
            ) : (
              <ul className="divide-y divide-border">
                {caja.movimientos.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <Badge variant="secondary" className={TIPO_BADGE[m.tipo]}>
                      {TIPO_LABEL[m.tipo]}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {m.concepto || '—'}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        m.tipo === 'ingreso' ? 'text-success-foreground' : 'text-foreground'
                      )}
                    >
                      {m.tipo === 'ingreso' ? '+' : '−'}
                      {formatPeso(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Abrir caja ------------------------------ */

function AbrirCajaCard({ tenantId }: { tenantId: string }) {
  const abrirMutation = useAbrirCaja(tenantId);
  const [montoInicial, setMontoInicial] = useState('');

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Abrir caja</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ingresá el monto inicial en efectivo con el que arranca el turno.
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            abrirMutation.mutate(Number(montoInicial), {
              onSuccess: () => setMontoInicial(''),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="monto-inicial">Monto inicial</Label>
            <MontoInput
              id="monto-inicial"
              value={montoInicial}
              onChange={setMontoInicial}
              placeholder="0,00"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={abrirMutation.isPending}>
            {abrirMutation.isPending ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Modal: Cerrar caja --------------------------- */

function CerrarCajaDialog({
  caja,
  tenantId,
  open,
  onOpenChange,
  onCerrada,
}: {
  caja: CajaActual;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCerrada: (id: string) => void;
}) {
  const cerrarMutation = useCerrarCaja(tenantId);
  const [montoContado, setMontoContado] = useState('');

  const contado = Number(montoContado);
  const diferencia = montoContado === '' ? null : contado - caja.esperadoEnCaja;

  const handleCerrar = () => {
    cerrarMutation.mutate(
      { cajaId: caja.id, montoContado: contado, notas: '' },
      {
        onSuccess: () => {
          setMontoContado('');
          onCerrada(caja.id);
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setMontoContado('');
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>Abierta a las {formatHora(caja.abiertaAt)} hs</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Esperado en caja</span>
            <span className="text-xl font-semibold tracking-tight">
              {formatPeso(caja.esperadoEnCaja)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="monto-contado"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Efectivo contado
            </Label>
            <MontoInput
              id="monto-contado"
              value={montoContado}
              onChange={setMontoContado}
              placeholder="0,00"
              className="text-base font-semibold"
              autoFocus
            />
          </div>

          {diferencia !== null && (
            <div
              className={cn(
                'flex items-center justify-between rounded-md px-4 py-3',
                diferencia >= 0 ? 'bg-success-subtle' : 'bg-destructive/10'
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-2 text-sm font-medium',
                  diferencia >= 0 ? 'text-success-foreground' : 'text-destructive'
                )}
              >
                {diferencia >= 0 && <Check className="size-4" />}
                Diferencia
              </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  diferencia >= 0 ? 'text-success-foreground' : 'text-destructive'
                )}
              >
                {diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}
                {formatPeso(Math.abs(diferencia))} ·{' '}
                {diferencia === 0 ? 'sin faltante' : diferencia > 0 ? 'sobrante' : 'faltante'}
              </span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Tarjeta y Mercado Pago no afectan el efectivo en caja.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleCerrar} disabled={cerrarMutation.isPending || montoContado === ''}>
            {cerrarMutation.isPending ? 'Cerrando…' : 'Cerrar caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Modal: Detalle del cierre ------------------------- */

function DetalleCierreDialog({
  sesionId,
  onOpenChange,
}: {
  sesionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detalle, isLoading } = useDetalleCierre(sesionId);

  return (
    <Dialog open={sesionId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del cierre</DialogTitle>
          {detalle?.cerradaAt && (
            <DialogDescription>
              {formatFechaLarga(detalle.cerradaAt)} · {formatHora(detalle.cerradaAt)} hs
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading || !detalle ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando detalle…</p>
        ) : (
          <div className="divide-y divide-border">
            <div className="pb-2">
              <DetalleRow label="Monto inicial" valor={formatPeso(detalle.montoInicial)} />
              <DetalleRow label="Ventas en efectivo" valor={formatPeso(detalle.ventasEfectivo)} />
              <DetalleRow
                label="Ingresos"
                valor={`+ ${formatPeso(detalle.ingresos)}`}
                tono="success"
              />
              <DetalleRow label="Egresos" valor={`− ${formatPeso(detalle.egresos)}`} />
              <DetalleRow label="Retiros" valor={`− ${formatPeso(detalle.retiros)}`} />
            </div>
            <div className="py-2">
              <DetalleRow label="Esperado" valor={formatPeso(detalle.esperado)} bold />
              <DetalleRow label="Contado" valor={formatPeso(detalle.contado)} bold />
            </div>
            <div className="pt-3">
              <div
                className={cn(
                  'flex items-center justify-between rounded-md px-4 py-3 text-sm font-semibold',
                  detalle.diferencia < 0
                    ? 'bg-destructive/10 text-destructive'
                    : detalle.diferencia > 0
                      ? 'bg-success-subtle text-success-foreground'
                      : 'bg-muted text-foreground'
                )}
              >
                <span>Diferencia</span>
                <DiferenciaText valor={detalle.diferencia} plain />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Reimprimir Z
          </Button>
          <DialogClose asChild>
            <Button>Listo</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Auxiliares ------------------------------ */

function ResumenCard({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border p-4 shadow-sm',
        destacado ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card'
      )}
    >
      <span
        className={cn(
          'text-xs font-medium',
          destacado ? 'text-primary-foreground/90' : 'text-muted-foreground'
        )}
      >
        {titulo}
      </span>
      <span className="text-lg font-semibold tracking-tight">{valor}</span>
    </div>
  );
}

function MontoInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('pl-7', className)}
        {...props}
      />
    </div>
  );
}

function DetalleRow({
  label,
  valor,
  bold,
  tono,
}: {
  label: string;
  valor: string;
  bold?: boolean;
  tono?: 'success';
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className={cn(bold ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          bold ? 'font-semibold' : 'font-medium',
          tono === 'success' && 'text-success-foreground'
        )}
      >
        {valor}
      </span>
    </div>
  );
}

function DiferenciaText({ valor, plain }: { valor: number; plain?: boolean }) {
  if (valor === 0) {
    return (
      <span className={cn(!plain && 'font-semibold text-muted-foreground')}>{formatPeso(0)}</span>
    );
  }
  const positivo = valor > 0;
  return (
    <span
      className={cn(
        !plain && 'font-semibold',
        !plain && (positivo ? 'text-success-foreground' : 'text-destructive')
      )}
    >
      {positivo ? '+' : '−'}
      {formatPeso(Math.abs(valor))} · {positivo ? 'sobrante' : 'faltante'}
    </span>
  );
}
