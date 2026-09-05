'use client';

import { useState, useTransition } from 'react';
import {
  Star,
  MessageCircle,
  Phone,
  Clock,
  User,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { toast } from 'sonner';
import { cambiarEstadoResenaAction } from '../resenasActions';
import { ASPECTOS_LABELS, type AspectoCritica, type EstadoResena, type ResenaClienteDto } from '../types';

export function ResenasFeed({ initialResenas }: { initialResenas: ResenaClienteDto[] }) {
  const [resenas, setResenas] = useState<ResenaClienteDto[]>(initialResenas);
  const [filtro, setFiltro] = useState<'todas' | 'negativas' | 'google' | 'pendientes'>('todas');
  const [isPending, startTransition] = useTransition();

  const handleCambiarEstado = (resenaId: string, nuevoEstado: EstadoResena) => {
    startTransition(async () => {
      const res = await cambiarEstadoResenaAction({ resenaId, estado: nuevoEstado });
      if (res.success) {
        setResenas((prev) =>
          prev.map((r) => (r.id === resenaId ? { ...r, estado: nuevoEstado } : r)),
        );
        toast.success(`Estado actualizado a ${nuevoEstado}`);
      } else {
        toast.error(res.message || 'Error al actualizar');
      }
    });
  };

  const filtered = resenas.filter((r) => {
    if (filtro === 'negativas') return r.estrellas <= 3;
    if (filtro === 'google') return r.derivadaAGoogle;
    if (filtro === 'pendientes') return r.estrellas <= 3 && r.estado !== 'resuelto';
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Historial de opiniones y feedback</CardTitle>
            <CardDescription>
              Quejas privadas para resolver antes de que lleguen a Google.
            </CardDescription>
          </div>
          {/* Filtros */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1 text-xs">
            <Filter className="size-3.5 text-muted-foreground ml-1.5" />
            <button
              type="button"
              onClick={() => setFiltro('todas')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtro === 'todas'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todas ({resenas.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('pendientes')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtro === 'pendientes'
                  ? 'bg-background shadow-xs text-amber-600 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pendientes ({resenas.filter((r) => r.estrellas <= 3 && r.estado !== 'resuelto').length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('negativas')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtro === 'negativas'
                  ? 'bg-background shadow-xs text-destructive font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              1–3★ ({resenas.filter((r) => r.estrellas <= 3).length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('google')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filtro === 'google'
                  ? 'bg-background shadow-xs text-emerald-600 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Google Maps ({resenas.filter((r) => r.derivadaAGoogle).length})
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay opiniones en esta categoría.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => {
              const esBaja = item.estrellas <= 3;
              const cleanTel = (item.contactoTelefono || '').replace(/\D/g, '');
              const waUrl = cleanTel
                ? `https://wa.me/${cleanTel.startsWith('54') ? cleanTel : `549${cleanTel}`}?text=${encodeURIComponent(`Hola ${item.contactoNombre || ''}, te escribimos de parte del restaurante respecto a tu visita.`)}`
                : null;

              return (
                <div key={item.id} className="py-4 space-y-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    {/* Estrellas y origen */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`size-4 ${
                                s <= item.estrellas
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground/20'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {item.identificadorMesa ||
                            (item.origen === 'delivery' ? 'Delivery' : 'Mostrador / Salón')}
                        </span>
                        {item.derivadaAGoogle ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]"
                          >
                            Derivado a Google
                          </Badge>
                        ) : esBaja ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            Filtro privado
                          </Badge>
                        ) : null}
                      </div>

                      {/* Aspectos etiquetados */}
                      {item.aspectos.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.aspectos.map((asp) => (
                            <span
                              key={asp}
                              className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium"
                            >
                              {ASPECTOS_LABELS[asp as AspectoCritica] || asp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selector de estado (solo para feedback negativo) */}
                    {esBaja ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={item.estado}
                          onValueChange={(v) => handleCambiarEstado(item.id, v as EstadoResena)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nuevo">🔴 Nuevo</SelectItem>
                            <SelectItem value="leido">🟡 Leído</SelectItem>
                            <SelectItem value="contactado">🔵 Contactado</SelectItem>
                            <SelectItem value="resuelto">🟢 Resuelto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Comentario si dejó */}
                  {item.comentario && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                      &ldquo;{item.comentario}&rdquo;
                    </div>
                  )}

                  {/* Datos de contacto y botón de WhatsApp */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {item.contactoNombre && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="size-3 text-muted-foreground" />
                          {item.contactoNombre}
                        </span>
                      )}
                      {item.contactoTelefono && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="size-3 text-muted-foreground" />
                          {item.contactoTelefono}
                        </span>
                      )}
                      {esBaja && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="size-3" />
                          {new Date(item.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    {waUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                        asChild
                      >
                        <a href={waUrl} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-1.5 size-3.5 text-emerald-600" />
                          Contactar por WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
