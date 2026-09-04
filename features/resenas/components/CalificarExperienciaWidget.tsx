'use client';

import { useState, useEffect, useTransition } from 'react';
import { Star, ExternalLink, MessageSquare, Check, HeartHandshake, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/lib/utils';
import { enviarFeedbackAction, getConfigResenasPublicAction } from '../resenasActions';
import { ASPECTOS_LABELS, type AspectoCritica, type OrigenResena } from '../types';

export function CalificarExperienciaWidget({
  slug,
  origen = 'mesa',
  mesaId,
  pedidoId,
  identificadorMesa,
  googleReviewUrl,
  minEstrellasGoogle = 4,
  onFinalizado,
  className,
}: {
  slug: string;
  origen?: OrigenResena;
  mesaId?: string | null;
  pedidoId?: string | null;
  identificadorMesa?: string | null;
  googleReviewUrl?: string | null;
  minEstrellasGoogle?: number;
  onFinalizado?: () => void;
  className?: string;
}) {
  const [estrellas, setEstrellas] = useState<number>(0);
  const [hoverEstrellas, setHoverEstrellas] = useState<number>(0);
  const [aspectos, setAspectos] = useState<AspectoCritica[]>([]);
  const [comentario, setComentario] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [derivadoGoogle, setDerivadoGoogle] = useState(false);
  const [resolvedGoogleUrl, setResolvedGoogleUrl] = useState<string | null>(googleReviewUrl ?? null);
  const [resolvedMinStars, setResolvedMinStars] = useState<number>(minEstrellasGoogle);
  const [activas, setActivas] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (googleReviewUrl === undefined) {
      getConfigResenasPublicAction(slug).then((cfg) => {
        if (cfg) {
          setResolvedGoogleUrl(cfg.googleReviewUrl);
          setResolvedMinStars(cfg.minEstrellasGoogle);
          setActivas(cfg.activas);
        }
      });
    }
  }, [slug, googleReviewUrl]);

  if (!activas) return null;

  const activeStars = hoverEstrellas || estrellas;
  const esPositivo = estrellas >= resolvedMinStars;

  const toggleAspecto = (asp: AspectoCritica) => {
    setAspectos((prev) =>
      prev.includes(asp) ? prev.filter((a) => a !== asp) : [...prev, asp],
    );
  };

  const handleSelectStar = (n: number) => {
    setEstrellas(n);
  };

  const handleEnviarPositivo = () => {
    startTransition(async () => {
      await enviarFeedbackAction({
        slug,
        estrellas,
        origen,
        mesaId,
        pedidoId,
        identificadorMesa,
      });

      setDerivadoGoogle(true);
      setEnviado(true);

      if (resolvedGoogleUrl) {
        window.open(resolvedGoogleUrl, '_blank', 'noopener,noreferrer');
      }

      onFinalizado?.();
    });
  };

  const handleEnviarNegativo = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await enviarFeedbackAction({
        slug,
        estrellas,
        origen,
        mesaId,
        pedidoId,
        identificadorMesa,
        aspectos,
        comentario,
        contactoNombre: nombre,
        contactoTelefono: telefono,
      });

      setDerivadoGoogle(false);
      setEnviado(true);
      onFinalizado?.();
    });
  };

  if (enviado) {
    return (
      <div className={cn('rounded-2xl border bg-card p-6 text-center shadow-sm', className)}>
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20">
          <Check className="size-6" />
        </div>
        <h3 className="text-lg font-semibold">¡Muchas gracias por tu opinión!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {derivadoGoogle
            ? 'Tu valoración nos ayuda a seguir creciendo y que más gente conozca el local.'
            : 'Tu mensaje fue enviado directamente al encargado para solucionar lo ocurrido.'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card p-6 shadow-sm', className)}>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {identificadorMesa ? identificadorMesa : 'Tu opinión importa'}
        </p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">
          ¿Cómo estuvo tu experiencia hoy?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tocá las estrellas para calificar
        </p>

        {/* Estrellas interactivas */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleSelectStar(n)}
              onMouseEnter={() => setHoverEstrellas(n)}
              onMouseLeave={() => setHoverEstrellas(0)}
              className="p-1 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
              aria-label={`${n} estrellas`}
            >
              <Star
                className={cn(
                  'size-8 transition-colors sm:size-10',
                  n <= activeStars
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-transparent text-muted-foreground/30',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Caso 1: 4 o 5 estrellas (Derivación a Google Maps) */}
      {estrellas > 0 && esPositivo && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-xl bg-amber-500/10 p-4 text-center dark:bg-amber-500/20">
            <HeartHandshake className="mx-auto size-6 text-amber-600 dark:text-amber-400" />
            <p className="mt-2 text-sm font-medium text-amber-950 dark:text-amber-100">
              ¡Nos alegra un montón que hayas disfrutado!
            </p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
              Para nuestro equipo significa muchísimo si compartís tu experiencia en Google Maps.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {resolvedGoogleUrl ? (
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                size="lg"
                onClick={handleEnviarPositivo}
                disabled={isPending}
              >
                <ExternalLink className="mr-2 size-4" />
                Dejar reseña en Google Maps
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleEnviarPositivo}
                disabled={isPending}
              >
                Enviar calificación
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Caso 2: 1, 2 o 3 estrellas (Pararrayos privado interno) */}
      {estrellas > 0 && !esPositivo && (
        <form
          onSubmit={handleEnviarNegativo}
          className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-5 shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Lamentamos que no haya sido una experiencia perfecta.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tu mensaje va directo al encargado del local para que podamos solucionarlo.
                </p>
              </div>
            </div>
          </div>

          {/* Aspectos rápidos */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              ¿Qué podemos mejorar?
            </Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(ASPECTOS_LABELS) as AspectoCritica[]).map((asp) => {
                const selected = aspectos.includes(asp);
                return (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => toggleAspecto(asp)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                      selected
                        ? 'bg-destructive/15 border-destructive/40 text-destructive font-semibold'
                        : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {ASPECTOS_LABELS[asp]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comentario libre */}
          <div className="space-y-1.5">
            <Label htmlFor="feedback-comentario" className="text-xs">
              Contanos qué pasó (opcional)
            </Label>
            <Textarea
              id="feedback-comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="¿Hubo algún problema con la comida, el tiempo o la atención?"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Contacto opcional */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="contacto-nombre" className="text-xs text-muted-foreground">
                Tu nombre (opcional)
              </Label>
              <Input
                id="contacto-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Lucas"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contacto-tel" className="text-xs text-muted-foreground">
                WhatsApp / Teléfono (opcional)
              </Label>
              <Input
                id="contacto-tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Por si podemos compensarte"
                maxLength={40}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            variant="default"
            size="lg"
            disabled={isPending}
          >
            <MessageSquare className="mr-2 size-4" />
            {isPending ? 'Enviando…' : 'Enviar mensaje al encargado'}
          </Button>
        </form>
      )}
    </div>
  );
}
