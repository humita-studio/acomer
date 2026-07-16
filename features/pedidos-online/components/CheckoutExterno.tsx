'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPinned, Clock, LocateFixed } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatPeso } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { getCartTotal, type CartItem, type CartPromoResumen } from '@/features/carta/cart';
import { geocodeDireccionAction, reverseGeocodeAction } from '@/shared/maps/geocode';
import { puntoEnZona, type LatLng } from '@/shared/maps/zonaMapa';
import { crearPedidoExternoAction } from '../pedidoExternoActions';
import {
  costoEnvioEfectivo,
  type DeliveryConfig,
  type ModoPedido,
} from '../deliveryConfig';
import { validarCheckoutCliente } from '../checkoutValidation';
import { ZonaEntregaMapaLazy } from './ZonaEntregaMapaLazy';

type Tipo = 'takeaway' | 'delivery';

type GeoStatus = 'idle' | 'buscando' | 'ok' | 'fuera' | 'denegado' | 'error' | 'sin_dir';

function Campo({
  label,
  opcional,
  children,
}: {
  label: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-[0.2px] text-muted-foreground">
        {label}
        {opcional ? <span className="text-muted-foreground/70"> (opcional)</span> : null}
      </label>
      {children}
    </div>
  );
}

function pinsIguales(a: LatLng | null, b: LatLng | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

export function CheckoutExterno({
  open,
  onClose,
  tenantSlug,
  cartItems,
  modos,
  deliveryConfig,
  promoResumen = null,
  onPedidoCreado,
}: {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  cartItems: CartItem[];
  modos: ModoPedido[];
  /** Config del local (zona, costo, mínimo, tiempo). */
  deliveryConfig: DeliveryConfig;
  promoResumen?: CartPromoResumen | null;
  onPedidoCreado: (sesionId: string, tipo: Tipo) => void;
}) {
  const opciones: Tipo[] = modos.length > 0 ? modos : ['takeaway', 'delivery'];
  const [tipo, setTipo] = useState<Tipo>(opciones[0]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoHint, setGeoHint] = useState<string | null>(null);

  // Evita que el reverse-geocode pise lo que el usuario está tipeando.
  const direccionManualRef = useRef(false);
  // Evita loops: geocode de texto no debe re-disparar reverse del pin que él mismo puso.
  const pinOrigenRef = useRef<'gps' | 'mapa' | 'direccion' | null>(null);
  const geoTriedRef = useRef(false);
  const geocodeSeq = useRef(0);

  const poly = deliveryConfig.zonaPoligono;
  const tieneMapa = Boolean(poly);

  useEffect(() => {
    if (!opciones.includes(tipo)) setTipo(opciones[0]);
  }, [opciones, tipo]);

  // Al cambiar a takeaway limpiamos pin/hints de delivery.
  useEffect(() => {
    if (tipo !== 'delivery') {
      setPin(null);
      setGeoStatus('idle');
      setGeoHint(null);
      pinOrigenRef.current = null;
    }
  }, [tipo]);

  // Reset de auto-GPS al cerrar el sheet (próxima apertura reintenta).
  useEffect(() => {
    if (!open) {
      geoTriedRef.current = false;
      setGeoStatus('idle');
      setGeoHint(null);
    }
  }, [open]);

  const aplicarPin = useCallback(
    async (pt: LatLng, origen: 'gps' | 'mapa' | 'direccion', opts?: { rellenarDir?: boolean }) => {
      if (poly && !puntoEnZona(poly, pt)) {
        setGeoStatus('fuera');
        setGeoHint('Esa ubicación está fuera de la zona de entrega del local.');
        // Igual marcamos el pin para que vea dónde quedó (y el mapa lo pinta en rojo vía pinOk).
        setPin(pt);
        pinOrigenRef.current = origen;
        return false;
      }

      setPin(pt);
      pinOrigenRef.current = origen;
      setGeoStatus('ok');
      setGeoHint(
        origen === 'gps'
          ? 'Usamos tu ubicación actual.'
          : origen === 'direccion'
            ? 'Marcamos la dirección en el mapa.'
            : 'Ubicación marcada en el mapa.',
      );

      const rellenar = opts?.rellenarDir ?? origen !== 'direccion';
      if (rellenar && !direccionManualRef.current) {
        const dir = await reverseGeocodeAction(pt.lat, pt.lng);
        if (dir) {
          setDireccion(dir);
          direccionManualRef.current = false;
        } else if (origen === 'gps') {
          setGeoStatus('sin_dir');
          setGeoHint('Marcamos tu ubicación. Completá la dirección (calle y número).');
        }
      }
      return true;
    },
    [poly],
  );

  const pedirUbicacion = useCallback(
    (opts?: { manual?: boolean }) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        setGeoStatus('error');
        setGeoHint('Tu dispositivo no permite geolocalización. Escribí la dirección.');
        return;
      }

      setGeoStatus('buscando');
      setGeoHint(opts?.manual ? 'Obteniendo tu ubicación…' : 'Detectando tu ubicación…');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void aplicarPin(
            {
              lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
              lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
            },
            'gps',
            { rellenarDir: true },
          );
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeoStatus('denegado');
            setGeoHint(
              'No pudimos usar tu ubicación. Escribí la dirección o tocá el mapa.',
            );
          } else {
            setGeoStatus('error');
            setGeoHint('No pudimos obtener tu ubicación. Escribí la dirección o tocá el mapa.');
          }
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
      );
    },
    [aplicarPin],
  );

  // Auto-GPS al abrir checkout en modo delivery (una vez por apertura).
  useEffect(() => {
    if (!open || tipo !== 'delivery' || !tieneMapa) return;
    if (geoTriedRef.current) return;
    if (pin) return;
    geoTriedRef.current = true;
    pedirUbicacion();
  }, [open, tipo, tieneMapa, pin, pedirUbicacion]);

  // Geocode de la dirección tipeada → pin en el mapa.
  useEffect(() => {
    if (!open || tipo !== 'delivery' || !tieneMapa) return;
    const raw = direccion.trim();
    if (raw.length < 6) return;
    // Si el pin vino del mapa/GPS y la dirección la rellenamos nosotros, no re-geocodear.
    if (pinOrigenRef.current === 'gps' || pinOrigenRef.current === 'mapa') {
      if (!direccionManualRef.current) return;
    }

    const seq = ++geocodeSeq.current;
    const t = window.setTimeout(() => {
      void (async () => {
        setGeoHint('Buscando la dirección en el mapa…');
        const pt = await geocodeDireccionAction(raw);
        if (seq !== geocodeSeq.current) return;
        if (!pt) {
          setGeoStatus('error');
          setGeoHint('No encontramos esa dirección. Ajustá el texto o marcá el mapa a mano.');
          return;
        }
        await aplicarPin(pt, 'direccion', { rellenarDir: false });
      })();
    }, 700);

    return () => window.clearTimeout(t);
  }, [direccion, open, tipo, tieneMapa, aplicarPin]);

  const onPinDesdeMapa = useCallback(
    (pt: LatLng | null) => {
      if (!pt) {
        setPin(null);
        pinOrigenRef.current = null;
        return;
      }
      if (pinsIguales(pt, pin) && pinOrigenRef.current === 'mapa') return;
      // Click en mapa: el usuario eligió el punto; rellenar dirección.
      direccionManualRef.current = false;
      void aplicarPin(pt, 'mapa', { rellenarDir: true });
    },
    [aplicarPin, pin],
  );

  const subtotal = getCartTotal(cartItems);
  const descuento = promoResumen && promoResumen.descuento > 0 ? promoResumen.descuento : 0;
  const subtotalNeto = Math.max(0, subtotal - descuento);
  const envio = costoEnvioEfectivo(deliveryConfig, tipo);
  const total = subtotalNeto + envio;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clienteErr = validarCheckoutCliente({
      nombre,
      telefono,
      tipo,
      direccion,
      itemsCount: cartItems.length,
      subtotalCarrito: subtotalNeto,
      deliveryConfig,
      pin,
    });
    if (clienteErr) {
      setError(clienteErr);
      return;
    }

    setEnviando(true);
    try {
      const res = await crearPedidoExternoAction(
        tenantSlug,
        tipo,
        {
          nombreContacto: nombre.trim(),
          telefono: telefono.trim(),
          direccion: tipo === 'delivery' ? direccion.trim() : undefined,
          referencia: tipo === 'delivery' ? referencia.trim() || undefined : undefined,
          lat: tipo === 'delivery' ? pin?.lat : undefined,
          lng: tipo === 'delivery' ? pin?.lng : undefined,
        },
        cartItems.map((i) => ({
          productoId: i.productoId,
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          modificadores: i.modificadores.map((m) => ({ id: m.id })),
        })),
      );
      if (res.success && res.sesionId) {
        onPedidoCreado(res.sesionId, tipo);
      } else {
        setError(res.message ?? 'No se pudo confirmar el pedido. Probá de nuevo.');
        setEnviando(false);
      }
    } catch {
      setError('Sin conexión o error de red. Revisá internet e intentá de nuevo.');
      setEnviando(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o && !enviando) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[92vh] flex-col gap-0 bg-background p-0 sm:max-w-md sm:rounded-t-2xl"
      >
        <SheetHeader className="border-b p-5 text-left">
          <SheetTitle className="text-lg">Finalizá tu pedido</SheetTitle>
          <SheetDescription>
            Confirmamos el pedido al local. Después podés pagar online o al recibir/retirar.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {opciones.length > 1 ? (
              <div className="grid grid-cols-2 gap-3">
                {opciones.includes('takeaway') && (
                  <button
                    type="button"
                    onClick={() => setTipo('takeaway')}
                    className={cn(
                      'rounded-lg border py-3 text-sm font-medium transition-colors',
                      tipo === 'takeaway'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Retiro en local
                  </button>
                )}
                {opciones.includes('delivery') && (
                  <button
                    type="button"
                    onClick={() => setTipo('delivery')}
                    className={cn(
                      'rounded-lg border py-3 text-sm font-medium transition-colors',
                      tipo === 'delivery'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Envío a domicilio
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted py-3 text-center text-sm font-medium text-foreground">
                {opciones[0] === 'delivery' ? 'Envío a domicilio' : 'Retiro en local'}
              </div>
            )}

            <Campo label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoComplete="name"
                className="h-12 rounded-lg text-base"
                placeholder="Tu nombre"
              />
            </Campo>

            <Campo label="Teléfono">
              <Input
                type="tel"
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                autoComplete="tel"
                className="h-12 rounded-lg text-base"
                placeholder="Ej: 11 2345 6789"
              />
            </Campo>

            {tipo === 'delivery' ? (
              <>
                {(deliveryConfig.zonaEntrega ||
                  deliveryConfig.tiempoEstimadoMin ||
                  deliveryConfig.pedidoMinimo > 0) && (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
                    {deliveryConfig.zonaEntrega ? (
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <MapPinned className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          <span className="font-medium text-foreground">Zona de entrega: </span>
                          {deliveryConfig.zonaEntrega}
                        </span>
                      </p>
                    ) : null}
                    {deliveryConfig.tiempoEstimadoMin ? (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        Tiempo estimado: ~{deliveryConfig.tiempoEstimadoMin} min
                      </p>
                    ) : null}
                    {deliveryConfig.pedidoMinimo > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Pedido mínimo: {formatPeso(deliveryConfig.pedidoMinimo)}
                      </p>
                    ) : null}
                  </div>
                )}

                <Campo label="Dirección">
                  <Input
                    value={direccion}
                    onChange={(e) => {
                      direccionManualRef.current = true;
                      pinOrigenRef.current = 'direccion';
                      setDireccion(e.target.value);
                    }}
                    required
                    autoComplete="street-address"
                    className="h-12 rounded-lg text-base"
                    placeholder="Calle, número, barrio"
                  />
                </Campo>

                {tieneMapa && open ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium tracking-[0.2px] text-muted-foreground">
                        Ubicación en el mapa
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        disabled={geoStatus === 'buscando'}
                        onClick={() => {
                          direccionManualRef.current = false;
                          geoTriedRef.current = true;
                          pedirUbicacion({ manual: true });
                        }}
                      >
                        {geoStatus === 'buscando' ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <LocateFixed className="size-3.5" />
                        )}
                        Usar mi ubicación
                      </Button>
                    </div>

                    <ZonaEntregaMapaLazy
                      mode="pick"
                      value={deliveryConfig.zonaPoligono}
                      pin={pin}
                      onPinChange={onPinDesdeMapa}
                      height={300}
                    />

                    {geoHint ? (
                      <p
                        className={cn(
                          'text-xs',
                          geoStatus === 'fuera' || geoStatus === 'error' || geoStatus === 'denegado'
                            ? 'text-warning-foreground'
                            : geoStatus === 'ok'
                              ? 'text-success-foreground'
                              : 'text-muted-foreground',
                        )}
                      >
                        {geoStatus === 'buscando' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="size-3 animate-spin" />
                            {geoHint}
                          </span>
                        ) : (
                          geoHint
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <Campo label="Referencia" opcional>
                  <Input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="h-12 rounded-lg text-base"
                    placeholder="Ej: timbre roto, golpear"
                  />
                </Campo>
              </>
            ) : null}

            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t bg-muted/40 p-5">
            <div className="space-y-1 text-sm">
              {descuento > 0 || envio > 0 ? (
                <>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatPeso(subtotal)}</span>
                  </div>
                  {descuento > 0 ? (
                    <div className="flex items-center justify-between text-success-foreground">
                      <span>Descuento</span>
                      <span className="tabular-nums">−{formatPeso(descuento)}</span>
                    </div>
                  ) : null}
                  {tipo === 'delivery' ? (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Envío</span>
                      <span className="tabular-nums">
                        {envio > 0 ? formatPeso(envio) : 'Gratis'}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={enviando || cartItems.length === 0}
              size="lg"
              className="h-12 w-full justify-between text-base"
            >
              <span className="flex items-center gap-2">
                {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
                {enviando ? 'Confirmando…' : 'Confirmar pedido'}
              </span>
              <span className="tabular-nums">{formatPeso(total)}</span>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Al confirmar, el local recibe el pedido en cocina.
            </p>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
