import { listLocalesAction } from '@/features/platform/platformActions';
import { LocalesTable } from '@/features/platform/components/LocalesTable';

export default async function PlatformLocalesPage() {
  const result = await listLocalesAction();
  const locales = result.success ? result.locales : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Locales</h1>
        <p className="text-sm text-muted-foreground">
          Buscá por nombre o slug. Tocá un local para ops de billing.
        </p>
      </div>
      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : (
        <LocalesTable initialLocales={locales} />
      )}
    </div>
  );
}
