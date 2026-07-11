'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/shared/supabase/browser';
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
};

const MAX = 20;

/**
 * Campana de notificaciones del panel: escucha el canal Realtime del
 * restaurante y muestra eventos operativos (nuevo pedido, pago, cuenta).
 */
export function StaffNotifications({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const push = (title: string, body: string, href?: string) => {
      const n: Notif = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        body,
        href,
        at: Date.now(),
      };
      setItems((prev) => [n, ...prev].slice(0, MAX));
      setUnread((u) => u + 1);
      toast.message(title, { description: body });
    };

    const channel = supabase
      .channel(`admin_restaurant_${tenantId}`)
      .on('broadcast', { event: 'nuevo_pedido' }, (payload) => {
        const p = payload.payload as { etiqueta?: string } | undefined;
        push(
          'Nuevo pedido',
          p?.etiqueta ? `Origen: ${p.etiqueta}` : 'Llegó un pedido a cocina',
          '/admin/cocina',
        );
      })
      .on('broadcast', { event: 'orden_externa_nueva' }, (payload) => {
        const p = payload.payload as { tipo?: string } | undefined;
        push(
          'Pedido online',
          p?.tipo === 'delivery' ? 'Nuevo delivery' : 'Nuevo takeaway',
          '/admin/pedidos-online',
        );
      })
      .on('broadcast', { event: 'cuenta_solicitada' }, () => {
        push('Cuenta solicitada', 'Una mesa pidió la cuenta', '/admin/cobros');
      })
      .on('broadcast', { event: 'mesa_pagada' }, () => {
        push('Mesa pagada', 'Se completó un cobro', '/admin/cobros');
      })
      .on('broadcast', { event: 'pago_parcial' }, () => {
        push('Pago parcial', 'Hubo un pago que no cubre el total', '/admin/cobros');
      })
      .on('broadcast', { event: 'pedido_estado' }, (payload) => {
        const p = payload.payload as { estado?: string } | undefined;
        if (p?.estado === 'Listo') {
          push('Pedido listo', 'Hay un pedido para entregar', '/admin/cocina');
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const openChange = (open: boolean) => {
    if (open) setUnread(0);
  };

  return (
    <DropdownMenu onOpenChange={openChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Notificaciones" className="relative">
          <Bell />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white',
              )}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Sin novedades por ahora
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild className="cursor-pointer flex-col items-start gap-0.5">
              {n.href ? (
                <Link href={n.href}>
                  <span className="font-medium">{n.title}</span>
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
