'use client';

import { useState, useTransition } from 'react';
import { Settings, ExternalLink, Save, Check, MapPin, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { toast } from 'sonner';
import { actualizarConfigResenasAction } from '../resenasActions';
import type { ConfiguracionResenasDto } from '../types';

export function ResenasConfigCard({
  initialConfig,
}: {
  initialConfig: ConfiguracionResenasDto;
}) {
  const [googleUrl, setGoogleUrl] = useState(initialConfig.googleReviewUrl || '');
  const [activas, setActivas] = useState(initialConfig.resenasActivas ?? true);
  const [minEstrellas, setMinEstrellas] = useState(initialConfig.minEstrellasGoogle || 4);
  const [alertaNegativa, setAlertaNegativa] = useState(initialConfig.recibirAlertaNegativa ?? true);
  const [isPending, startTransition] = useTransition();

  const handleGuardar = () => {
    startTransition(async () => {
      const res = await actualizarConfigResenasAction({
        googleReviewUrl: googleUrl,
        resenasActivas: activas,
        minEstrellasGoogle: minEstrellas,
        recibirAlertaNegativa: alertaNegativa,
      });

      if (res.success) {
        toast.success('Configuración de reseñas guardada.');
      } else {
        toast.error(res.message || 'Error al guardar');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-muted-foreground" />
          <div>
            <CardTitle>Configuración de Google Maps & Reputación</CardTitle>
            <CardDescription>
              Configurá el enlace directo a tu ficha de Google Maps y las reglas del filtro.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle activación */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-semibold">Solicitar opinión a los clientes</Label>
            <p className="text-xs text-muted-foreground">
              Muestra el widget de calificación al pagar la mesa, pedir la cuenta o recibir delivery.
            </p>
          </div>
          <Switch checked={activas} onCheckedChange={setActivas} />
        </div>

        {/* Link de Google Review */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="google-url" className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-4 text-emerald-600" />
              Link directo de reseñas en Google Maps
            </Label>
            {googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
              >
                Probar enlace <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <Input
            id="google-url"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
            placeholder="https://g.page/r/.../review o https://search.google.com/local/writereview?placeid=..."
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <HelpCircle className="size-3 shrink-0" />
            Obtenelo en Google Business Profile → &quot;Pedir reseñas&quot; → &quot;Copiar vínculo&quot;.
          </p>
        </div>

        {/* Reglas de derivación */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 rounded-lg border p-4">
            <Label className="text-sm font-semibold">Umbral para derivar a Google</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Solo clientes con esta cantidad de estrellas o más verán el botón de Google Maps.
            </p>
            <div className="flex gap-2">
              {[4, 5].map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => setMinEstrellas(stars)}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold border transition-colors ${
                    minEstrellas === stars
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border text-foreground'
                  }`}
                >
                  Desde {stars} estrellas ★
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-2">
              <Label className="text-sm font-semibold">Alerta inmediata en el salón</Label>
              <p className="text-xs text-muted-foreground">
                Hace sonar la campana de notificaciones del staff cuando entra una queja privada (1–3★).
              </p>
            </div>
            <Switch checked={alertaNegativa} onCheckedChange={setAlertaNegativa} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={isPending}>
            {isPending ? (
              'Guardando…'
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
