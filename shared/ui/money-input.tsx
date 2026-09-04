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
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const lastEmittedValue = React.useRef<string | null>(null);

  // Sincroniza cuando el valor llega de afuera (ej. reset o carga inicial)
  React.useEffect(() => {
    const isExternalChange = value !== lastEmittedValue.current;
    if (!focused || isExternalChange) {
      setDisplay(formatMoneyFromValue(value, opts));
      lastEmittedValue.current = value == null ? '' : String(value);
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
        ref={inputRef}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={display}
        onChange={(e) => {
          const input = e.target;
          const rawValue = input.value;
          const selectionStart = input.selectionStart ?? rawValue.length;

          // Contamos cuántos caracteres significativos (dígitos y coma) había antes del cursor
          const charsBefore = rawValue.slice(0, selectionStart).replace(/[^\d,]/g, '').length;

          const result = formatMoneyTyping(rawValue, opts);
          setDisplay(result.display);
          lastEmittedValue.current = result.value;
          onValueChange(result.value);

          // Ajustar la posición del cursor luego del render para que no salte al final
          requestAnimationFrame(() => {
            if (!inputRef.current) return;
            let counted = 0;
            let newCursor = result.display.length;
            for (let i = 0; i < result.display.length; i++) {
              if (/[\d,]/.test(result.display[i])) {
                counted++;
              }
              if (counted === charsBefore) {
                newCursor = i + 1;
                break;
              }
            }
            inputRef.current.setSelectionRange(newCursor, newCursor);
          });
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
