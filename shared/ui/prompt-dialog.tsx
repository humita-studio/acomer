'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyInput } from '@/shared/ui/money-input';
import { Label } from '@/shared/ui/label';

export type PromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** type del input. `money` formatea pesos mientras se escribe. */
  inputType?: 'text' | 'number' | 'money';
  min?: number;
  max?: number;
  step?: string | number;
  /** Si devuelve string, se muestra como error y no cierra. */
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
};

/**
 * Diálogo con input (reemplazo de window.prompt).
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  inputType = 'text',
  min,
  max,
  step,
  validate,
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
    }
  }, [open, defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-2">
          {label ? (
            <Label htmlFor="prompt-dialog-input" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </Label>
          ) : null}
          {inputType === 'money' ? (
            <MoneyInput
              id="prompt-dialog-input"
              value={value}
              onValueChange={(v) => {
                setValue(v);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              aria-invalid={!!error}
            />
          ) : (
            <Input
              id="prompt-dialog-input"
              type={inputType}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              min={min}
              max={max}
              step={step}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              aria-invalid={!!error}
            />
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={submit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
