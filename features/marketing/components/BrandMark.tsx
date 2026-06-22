import { cn } from '@/shared/lib/utils';

/**
 * Marca "acomer": punto terracota + wordmark en Fraunces. `tone` controla el color
 * del texto para usarla tanto sobre fondo claro (foreground) como sobre el hero
 * oscuro (blanco).
 */
export function BrandMark({
  className,
  tone = 'foreground',
}: {
  className?: string;
  tone?: 'foreground' | 'inverse';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight',
        tone === 'inverse' ? 'text-white' : 'text-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'size-2.5 rounded-full',
          tone === 'inverse' ? 'bg-white' : 'bg-primary',
        )}
        aria-hidden
      />
      acomer
    </span>
  );
}
