'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
import { queryKeys } from '@/shared/query/keys';
import { getCajaActualAction } from '@/features/caja/cajaActions';
import {
  getAlertasStaffRecientesAction,
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
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [cajaUnread, setCajaUnread] = useState(false);
  const toastedCaja = useRef(false);
  /** IDs ya mostrados en esta sesión (dedupe realtime + poll). */
  const seenIds = useRef(new Set<string>());
  /** IDs que el usuario ya abrió/cerró (persisten entre reloads). */
  const dismissedIds = useRef<Set<string>>(new Set());
  const alertsHydrated = useRef(false);

  // Cargar dismisseds del tenant al montar / cambiar de local.
  useEffect(() => {
    dismissedIds.current = loadDismissed(tenantId);
    alertsHydrated.current = false;
    seenIds.current = new Set();
    setItems([]);
    setUnread(0);
  }, [tenantId]);

  const { data: caja, isPending: cajaPending } = useQuery({
    queryKey: queryKeys.caja(tenantId),
    queryFn: () => getCajaActualAction(),
    enabled: alertarCajaCerrada,
    refetchInterval: 20 * 1000,
    staleTime: 10 * 1000,
  });

  const cajaCerrada = alertarCajaCerrada && !cajaPending && caja == null;

  const { data: alertasDb } = useQuery({
    queryKey: queryKeys.staffAlerts(tenantId),
    queryFn: () => getAlertasStaffRecientesAction(),
    staleTime: 15 * 1000,
    refetchInterval: 20 * 1000,
  });

  useEffect(() => {
    if (!alertasDb) return;

    const visibles = alertasDb.filter((a) => !dismissedIds.current.has(a.id));

    // Primera carga: sembrar sin toast; solo no-leídas cuentan badge.
    if (!alertsHydrated.current) {
      alertsHydrated.current = true;
      for (const a of alertasDb) seenIds.current.add(a.id);
      setItems(visibles.map(alertToNotif).slice(0, MAX));
      setUnread(visibles.length);
      return;
    }

    // Refetch: solo nuevas no vistas y no dismissadas.
    const nuevas = alertasDb.filter(
      (a) => !seenIds.current.has(a.id) && !dismissedIds.current.has(a.id),
    );
    if (nuevas.length === 0) return;

    for (const a of nuevas) {
      seenIds.current.add(a.id);
      if (a.tipo === 'llamar_mozo') {
        toast.warning(a.titulo, { description: a.cuerpo, duration: 12_000 });
      } else {
        toast.message(a.titulo, { description: a.cuerpo });
      }
    }
    setItems((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      for (const a of nuevas) byId.set(a.id, alertToNotif(a));
      return Array.from(byId.values())
        .sort((a, b) => b.at - a.at)
        .slice(0, MAX);
    });
    setUnread((u) => u + nuevas.length);
  }, [alertasDb]);

  useEffect(() => {
    if (!alertarCajaCerrada || cajaPending) return;

    if (caja == null) {
      setCajaUnread(true);
      if (!toastedCaja.current) {
        toastedCaja.current = true;
        toast.message('Caja cerrada', {
          id: CAJA_CERRADA_ID,
          description: 'Abrí la caja para registrar ventas y cobros en efectivo',
        });
      }
    } else {
      setCajaUnread(false);
      toastedCaja.current = false;
      toast.dismiss(CAJA_CERRADA_ID);
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
      if (seenIds.current.has(id) || dismissedIds.current.has(id)) return;
      seenIds.current.add(id);

      const n: Notif = {
        id,
        title,
        body,
        href,
        at: Date.now(),
      };
      setItems((prev) => [n, ...prev.filter((x) => x.id !== id)].slice(0, MAX));
      setUnread((u) => u + 1);
      if (opts?.important) {
        toast.warning(title, { description: body, duration: 12_000 });
      } else {
        toast.message(title, { description: body });
      }
    },
    [],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const dataOf = (raw: unknown): Record<string, unknown> => {
      if (!raw || typeof raw !== 'object') return {};
      const r = raw as Record<string, unknown>;
      if (r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)) {
        return r.payload as Record<string, unknown>;
      }
      return r;
    };

    const onLlamarMozo = (raw: unknown) => {
      const p = dataOf(raw);
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
        typeof p.cuerpo === 'string' ? p.cuerpo : mesa ? `Mesa ${mesa}` : 'Una mesa necesita atención',
        typeof p.href === 'string' ? p.href : '/admin/mesas',
        { important: true, id },
      );
    };

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          await supabase.realtime.setAuth(data.session.access_token);
        }
      } catch {
        // canal público
      }
    })();

    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'nuevo_pedido' }, (payload) => {
        const p = dataOf(payload) as { etiqueta?: string };
        push(
          'Nuevo pedido',
          p.etiqueta ? `Origen: ${p.etiqueta}` : 'Llegó un pedido a cocina',
          '/admin/cocina',
        );
      })
      .on('broadcast', { event: 'orden_externa_nueva' }, (payload) => {
        const p = dataOf(payload) as { tipo?: string };
        push(
          'Pedido online',
          p.tipo === 'delivery' ? 'Nuevo delivery' : 'Nuevo takeaway / retiro',
          '/admin/pedidos-online',
          { important: true },
        );
      })
      .on('broadcast', { event: 'reserva_nueva' }, () => {
        push(
          'Nueva reserva',
          'Entró una reserva online. Revisala en la agenda.',
          '/admin/reservas',
          { important: true },
        );
      })
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        push('Cuenta solicitada', 'Una mesa pidió la cuenta', '/admin/cobros');
      })
      .on('broadcast', { event: 'llamar_mozo' }, onLlamarMozo)
      .on('broadcast', { event: 'mesa_pagada' }, () => {
        push('Mesa pagada', 'Se completó un cobro', '/admin/cobros');
      })
      .on('broadcast', { event: 'pago_parcial' }, () => {
        push('Pago parcial', 'Hubo un pago que no cubre el total', '/admin/cobros');
      })
      .on('broadcast', { event: 'pedido_estado' }, (payload) => {
        const p = dataOf(payload) as { estado?: string };
        if (p.estado === 'Listo') {
          push('Pedido listo', 'Hay un pedido para entregar', '/admin/cocina');
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[StaffNotifications] canal admin:', status, err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, push]);

  const openChange = (open: boolean) => {
    if (!open) return;
    // Al abrir: badge a 0 y se recuerdan como leídas (no reaparecen al recargar).
    // No vaciamos la lista acá: si no, el dropdown se abre vacío y parece un bug.
    setUnread(0);
    setCajaUnread(false);
    const ids = new Set(items.map((n) => n.id).filter((id) => id !== CAJA_CERRADA_ID));
    if (ids.size > 0) {
      for (const id of ids) dismissedIds.current.add(id);
      saveDismissed(tenantId, ids);
    }
  };

  const stickyCaja: Notif | null = cajaCerrada
    ? {
        id: CAJA_CERRADA_ID,
        title: 'Caja cerrada',
        body: 'Abrí la caja para registrar ventas y cobros en efectivo',
        href: '/admin/caja',
        at: 0,
        sticky: true,
      }
    : null;

  // Si hay sticky de caja y el usuario abre, no la borramos (es estado, no evento).
  const visible = stickyCaja ? [stickyCaja, ...items] : items;
  const badgeCount = unread + (cajaUnread && cajaCerrada ? 1 : 0);

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
