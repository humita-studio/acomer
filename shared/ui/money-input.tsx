'use client';

import * as React from 'react';

import { formatMoneyFromValue, formatMoneyTyping } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

export type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Valor canónico (ej. "1500.5" o 1500.5). */
  value: string | number | null | undefined;
  /** Recibe el valor canónico con punto decimal JS, o "" si vacío. */
  onValueChange: (value: string) => void;
  /** Permitir decimales (default true). */
  allowDecimals?: boolean;
  /** Máximo de decimales (default 2). */
  maxDecimals?: number;
  /** Prefijo "$" a la izquierda (default true). */
  showPrefix?: boolean;
};

/**
 * Input de dinero con formato es-AR mientras se escribe
 * (miles con punto, decimales con coma). El valor que sale por
 * `onValueChange` es canónico para `Number()` / el backend.
 */
export function MoneyInput({
  value,
  onValueChange,
  allowDecimals = true,
  maxDecimals = 2,
  showPrefix = true,
  className,
  onFocus,
  onBlur,
  name,
  ...props
}: MoneyInputProps) {
  const opts = React.useMemo(
    () => ({ allowDecimals, maxDecimals }),
    [allowDecimals, maxDecimals],
  );

  const [focused, setFocused] = React.useState(false);
  const [display, setDisplay] = React.useState(() => formatMoneyFromValue(value, opts));

  // Sincroniza cuando el valor llega de afuera y el input no tiene foco.
  React.useEffect(() => {
    if (!focused) {
      setDisplay(formatMoneyFromValue(value, opts));
    }
  }, [value, focused, opts]);

  const canonical =
    value == null || value === ''
      ? ''
      : typeof value === 'number'
        ? Number.isFinite(value)
          ? String(value)
          : ''
        : String(value);

  return (
    <div className="relative">
      {showPrefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
      ) : null}
      {/* Valor canónico para FormData / name= */}
      {name ? <input type="hidden" name={name} value={canonical} /> : null}
      <Input
        {...props}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={display}
        onChange={(e) => {
          const result = formatMoneyTyping(e.target.value, opts);
          setDisplay(result.display);
          onValueChange(result.value);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          setDisplay(formatMoneyFromValue(value, opts));
          onBlur?.(e);
        }}
        className={cn(showPrefix && 'pl-7', 'tabular-nums', className)}
      />
    </div>
  );
}
