'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { PromptDialog } from '@/shared/ui/prompt-dialog';

export type PromptOptions = {
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'number' | 'money';
  min?: number;
  max?: number;
  step?: string | number;
  validate?: (value: string) => string | null;
};

/**
 * Prompt imperativo (async) con UI propia.
 * Devuelve el string ingresado, o `null` si canceló.
 * Montá `promptDialog` en el árbol del componente.
 */
export function usePrompt(): {
  prompt: (opts: PromptOptions) => Promise<string | null>;
  promptDialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PromptOptions>({ title: '' });
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const settle = useCallback((value: string | null) => {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const promptDialog = (
    <PromptDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(null);
      }}
      title={opts.title}
      description={opts.description}
      label={opts.label}
      defaultValue={opts.defaultValue}
      placeholder={opts.placeholder}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      inputType={opts.inputType}
      min={opts.min}
      max={opts.max}
      step={opts.step}
      validate={opts.validate}
      onConfirm={(value) => settle(value)}
    />
  );

  return { prompt, promptDialog };
}
