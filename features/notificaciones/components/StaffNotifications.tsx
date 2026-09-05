'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBroadcast } from '@/shared/supabase/realtime';
import { etiquetaMesa } from '@/shared/lib/mesaLabel';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/query/keys';
import { formatFecha, formatFechaLarga } from '@/shared/lib/format';
import {
  getEstadoCampanaAction,
  type StaffAlertDto,
} from '@/features/notificaciones/staffAlertsActions';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

type Notif = {
  id: string;
  title: string;
  body: string;
  href?: string;
  at: number;
  /** Notificación de estado (p. ej. caja cerrada), no de un evento puntual. */
  sticky?: boolean;
};

const MAX = 20;
const CAJA_CERRADA_ID = 'caja-cerrada';
const CAJA_ABIERTA_OTRO_DIA_ID = 'caja-abierta-otro-dia';
/** Cuánto tiempo recordamos “ya la vi” (ms). */
const DISMISSED_TTL_MS = 48 * 60 * 60 * 1000;

function dismissedKey(tenantId: string) {
  return `acomer:staff-alerts-dismissed:${tenantId}`;
}

function loadDismissed(tenantId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(dismissedKey(tenantId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { id: string; at: number }[];
    if (!Array.isArray(parsed)) return new Set();
    const cutoff = Date.now() - DISMISSED_TTL_MS;
    const alive = parsed.filter((x) => x && typeof x.id === 'string' && x.at >= cutoff);
    // Limpia basura vieja.
    if (alive.length !== parsed.length) {
      localStorage.setItem(dismissedKey(tenantId), JSON.stringify(alive));
    }
    return new Set(alive.map((x) => x.id));
  } catch {
    return new Set();
  }
}

function saveDismissed(tenantId: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const prev = loadDismissed(tenantId);
    for (const id of ids) prev.add(id);
    const list = Array.from(prev).map((id) => ({ id, at: now }));
    // Cap para no inflar localStorage.
    localStorage.setItem(
      dismissedKey(tenantId),
      JSON.stringify(list.slice(-150)),
    );
  } catch {
    // private mode / quota
  }
}

function alertToNotif(a: StaffAlertDto): Notif {
  return {
    id: a.id,
    title: a.titulo,
    body: a.cuerpo,
    href: a.href ?? undefined,
    at: new Date(a.createdAt).getTime(),
  };
}

/**
 * Campana de notificaciones del panel: carga alertas persistidas + escucha
 * Realtime del restaurante (nuevo pedido, pago, llamar mozo, etc.).
 * Al abrir la campana se marcan como leídas (localStorage) y no reaparecen al recargar.
 */
export function StaffNotifications({
  tenantId,
  alertarCajaCerrada = false,
}: {
  tenantId: string;
  /** Roles con cobros/caja (owner, admin, cajero, mozo). */
  alertarCajaCerrada?: boolean;
}) {
  /** Notificaciones que llegaron por Realtime en esta sesión (no persisten). */
  const [pushed, setPushed] = useState<Notif[]>([]);
  /** IDs marcados como leídos al abrir la campana (sólo afectan el badge). */
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  /** Sticky de caja que el usuario ya vio; se vuelve a contar si cambia la situación. */
  const [cajaAckId, setCajaAckId] = useState<string | null>(null);
  /**
   * IDs descartados en sesiones anteriores (localStorage). Se lee una vez por
   * montaje: el layout remonta la campana con `key={tenantId}`.
   */
  const [dismissed] = useState<Set<string>>(() => loadDismissed(tenantId));
  const toastedCaja = useRef(false);
  const toastedCajaVieja = useRef(false);
  /** IDs ya mostrados en esta sesión (dedupe realtime + poll). */
  const seenIds = useRef(new Set<string>());
  /** IDs descartados durante esta sesión (además de `dismissed`). */
  const dismissedNow = useRef(new Set<string>());
  const alertsHydrated = useRef(false);

  const queryClient = useQueryClient();

  // Un solo poll (alertas + caja) cada 30 s: Realtime trae los eventos en vivo,
  // esto es el respaldo. Antes eran dos server actions cada 20 s por pantalla.
  const { data: campana, isPending: campanaPending } = useQuery({
    queryKey: queryKeys.campana(tenantId, alertarCajaCerrada),
    queryFn: () => getEstadoCampanaAction({ conCaja: alertarCajaCerrada }),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const caja = campana?.caja ?? null;
  const cajaPending = alertarCajaCerrada && campanaPending;
  const alertasDb = campana?.alertas;

  const cajaCerrada = alertarCajaCerrada && !cajaPending && caja == null;
  /** Quedó abierta de una jornada anterior (se abrió otro día y nadie la cerró). */
  const cajaAbiertaOtroDia =
    alertarCajaCerrada &&
    !cajaPending &&
    caja != null &&
    formatFecha(caja.abiertaAt) !== formatFecha(new Date());

  // Lista visible = alertas persistidas (no descartadas) + las que llegaron por
  // Realtime. Es derivada, no se sincroniza en un efecto.
  const items = useMemo(() => {
    const byId = new Map<string, Notif>();
    for (const a of alertasDb ?? []) {
      if (!dismissed.has(a.id)) byId.set(a.id, alertToNotif(a));
    }
    for (const n of pushed) {
      if (!dismissed.has(n.id) && !byId.has(n.id)) byId.set(n.id, n);
    }
    return Array.from(byId.values())
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX);
  }, [alertasDb, pushed, dismissed]);

  const unread = items.reduce((n, it) => n + (readIds.has(it.id) ? 0 : 1), 0);

  // Toast de las alertas nuevas que trae el poll (la primera carga sólo siembra).
  useEffect(() => {
    if (!alertasDb) return;

    if (!alertsHydrated.current) {
      alertsHydrated.current = true;
      for (const a of alertasDb) seenIds.current.add(a.id);
      return;
    }

    for (const a of alertasDb) {
      if (
        seenIds.current.has(a.id) ||
        dismissed.has(a.id) ||
        dismissedNow.current.has(a.id)
      ) {
        continue;
      }
      seenIds.current.add(a.id);
      if (a.tipo === 'llamar_mozo') {
        toast.warning(a.titulo, { description: a.cuerpo, duration: 12_000 });
      } else {
        toast.message(a.titulo, { description: a.cuerpo });
      }
    }
  }, [alertasDb, dismissed]);

  useEffect(() => {
    if (!alertarCajaCerrada || cajaPending) return;

    if (caja == null) {
      toastedCajaVieja.current = false;
      toast.dismiss(CAJA_ABIERTA_OTRO_DIA_ID);
      if (!toastedCaja.current) {
        toastedCaja.current = true;
        toast.message('Caja cerrada', {
          id: CAJA_CERRADA_ID,
          description: 'Abrí la caja para registrar ventas y cobros en efectivo',
        });
      }
    } else if (formatFecha(caja.abiertaAt) !== formatFecha(new Date())) {
      toastedCaja.current = false;
      toast.dismiss(CAJA_CERRADA_ID);
      if (!toastedCajaVieja.current) {
        toastedCajaVieja.current = true;
        toast.message('La caja sigue abierta', {
          id: CAJA_ABIERTA_OTRO_DIA_ID,
          description: `Se abrió el ${formatFechaLarga(caja.abiertaAt)} y todavía no se cerró.`,
        });
      }
    } else {
      toastedCaja.current = false;
      toastedCajaVieja.current = false;
      toast.dismiss(CAJA_CERRADA_ID);
      toast.dismiss(CAJA_ABIERTA_OTRO_DIA_ID);
    }
  }, [alertarCajaCerrada, caja, cajaPending]);

  const push = useCallback(
    (
      title: string,
      body: string,
      href?: string,
      opts?: { important?: boolean; id?: string },
    ) => {
      const id = opts?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (seenIds.current.has(id) || dismissed.has(id) || dismissedNow.current.has(id)) return;
      seenIds.current.add(id);

      const n: Notif = {
        id,
        title,
        body,
        href,
        at: Date.now(),
      };
      setPushed((prev) => [n, ...prev.filter((x) => x.id !== id)].slice(0, MAX));
      if (opts?.important) {
        toast.warning(title, { description: body, duration: 12_000 });
      } else {
        toast.message(title, { description: body });
      }
    },
    [dismissed],
  );

  useBroadcast(`admin_restaurant_${tenantId}`, {
    nuevo_pedido: (p) => {
      const etiqueta = typeof p.etiqueta === 'string' ? p.etiqueta : null;
      push(
        'Nuevo pedido',
        etiqueta ? `Origen: ${etiqueta}` : 'Llegó un pedido a cocina',
        '/admin/cocina',
      );
    },
    orden_externa_nueva: (p) => {
      push(
        'Pedido online',
        p.tipo === 'delivery' ? 'Nuevo delivery' : 'Nuevo takeaway / retiro',
        '/admin/pedidos-online',
        { important: true },
      );
    },
    reserva_nueva: () => {
      push(
        'Nueva reserva',
        'Entró una reserva online. Revisala en la agenda.',
        '/admin/reservas',
        { important: true },
      );
    },
    cuenta_solicitada: () => {
      push('Cuenta solicitada', 'Una mesa pidió la cuenta', '/admin/cobros');
    },
    llamar_mozo: (p) => {
      if (p.tipo != null && p.tipo !== 'llamar_mozo') return;
      const mesa =
        typeof p.mesaIdentificador === 'string'
          ? p.mesaIdentificador.trim()
          : typeof p.cuerpo === 'string'
            ? p.cuerpo.replace(/^Mesa\s+/i, '').trim()
            : '';
      const id =
        typeof p.id === 'string'
          ? p.id
          : `llamar_mozo:${mesa || 'x'}:${Math.floor(Date.now() / 5000)}`;
      push(
        typeof p.titulo === 'string' ? p.titulo : 'Llaman al mozo',
        typeof p.cuerpo === 'string' ? p.cuerpo : mesa ? etiquetaMesa(mesa) : 'Una mesa necesita atención',
        typeof p.href === 'string' ? p.href : '/admin/mesas',
        { important: true, id },
      );
    },
    // La caja cambió en otra pestaña/caja: refrescar el sticky sin esperar el poll.
    caja_actualizada: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.caja(tenantId) });
    },
    mesa_pagada: () => {
      push('Mesa pagada', 'Se completó un cobro', '/admin/cobros');
    },
    pago_parcial: () => {
      push('Pago parcial', 'Hubo un pago que no cubre el total', '/admin/cobros');
    },
    pedido_estado: (p) => {
      if (p.estado === 'Listo') {
        push('Pedido listo', 'Hay un pedido para entregar', '/admin/cocina');
      }
    },
  });

  const stickyCaja: Notif | null = cajaCerrada
    ? {
        id: CAJA_CERRADA_ID,
        title: 'Caja cerrada',
        body: 'Abrí la caja para registrar ventas y cobros en efectivo',
        href: '/admin/caja',
        at: 0,
        sticky: true,
      }
    : cajaAbiertaOtroDia && caja
      ? {
          id: CAJA_ABIERTA_OTRO_DIA_ID,
          title: 'La caja sigue abierta',
          body: `Se abrió el ${formatFechaLarga(caja.abiertaAt)} y todavía no se cerró.`,
          href: '/admin/caja',
          at: 0,
          sticky: true,
        }
      : null;

  const openChange = (open: boolean) => {
    if (!open) return;
    // Al abrir: badge a 0 y se recuerdan como leídas (no reaparecen al recargar).
    // No vaciamos la lista acá: si no, el dropdown se abre vacío y parece un bug.
    setReadIds(new Set(items.map((n) => n.id)));
    setCajaAckId(stickyCaja?.id ?? null);
    const ids = new Set(
      items
        .map((n) => n.id)
        .filter((id) => id !== CAJA_CERRADA_ID && id !== CAJA_ABIERTA_OTRO_DIA_ID),
    );
    if (ids.size > 0) {
      for (const id of ids) dismissedNow.current.add(id);
      saveDismissed(tenantId, ids);
    }
  };

  // Si hay sticky de caja y el usuario abre, no la borramos (es estado, no evento).
  const visible = stickyCaja ? [stickyCaja, ...items] : items;
  const badgeCount = unread + (stickyCaja && cajaAckId !== stickyCaja.id ? 1 : 0);

  return (
    <DropdownMenu onOpenChange={openChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Notificaciones" className="relative">
          <Bell />
          {badgeCount > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white',
              )}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Sin novedades por ahora
          </div>
        ) : (
          visible.map((n) => (
            <DropdownMenuItem
              key={n.id}
              asChild
              className={cn(
                'cursor-pointer flex-col items-start gap-0.5',
                n.sticky && 'bg-warning-subtle/60 focus:bg-warning-subtle',
              )}
            >
              {n.href ? (
                <Link href={n.href}>
                  <span className="flex items-center gap-1.5 font-medium">
                    {n.sticky && <Wallet className="size-3.5 shrink-0" />}
                    {n.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </Link>
              ) : (
                <div>
                  <span className="font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </div>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
