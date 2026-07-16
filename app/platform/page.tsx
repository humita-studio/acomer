import Link from 'next/link';
import { getPlatformStatsAction } from '@/features/platform/platformActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';

export default async function PlatformHomePage() {
  const stats = await getPlatformStatsAction();

  const tiles = [
    { label: 'Locales', value: stats?.total ?? '—', hint: 'sin soft-delete' },
    { label: 'Activos', value: stats?.activos ?? '—', hint: 'activo = true' },
    { label: 'Trial', value: stats?.trial ?? '—', hint: 'billing trial' },
    { label: 'Exempt', value: stats?.exempt ?? '—', hint: 'pilotos' },
    { label: 'Vencidos', value: stats?.pastDue ?? '—', hint: 'past_due' },
    { label: 'Inactivos', value: stats?.inactive ?? '—', hint: 'activo = false' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Resumen
          </h1>
          <p className="text-sm text-muted-foreground">
            Operaciones de acomer sobre todos los locales.
          </p>
        </div>
        <Button asChild>
          <Link href="/platform/locales">Ver locales</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-semibold tabular-nums">
                {t.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
