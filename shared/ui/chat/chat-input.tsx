'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { CornerDownLeft, Loader2, Square } from 'lucide-react';

export interface ChatInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isGenerating?: boolean;
  onStop?: () => void;
  onSubmit?: () => void;
}

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      className,
      value,
      onChange,
      onKeyDown,
      onSubmit,
      onStop,
      isGenerating = false,
      placeholder = 'Preguntá algo o pedí una acción…',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Auto resize textarea height based on scrollHeight
    React.useEffect(() => {
      const textarea = internalRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (onSubmit && !isGenerating) {
          onSubmit();
        }
      }
      onKeyDown?.(e);
    };

    const hasContent = typeof value === 'string' ? value.trim().length > 0 : false;

    return (
      <div
        data-slot="chat-input-container"
        className={cn(
          'relative flex flex-col rounded-2xl border border-border/80 bg-card p-2 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20',
          className
        )}
      >
        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          rows={1}
          className="w-full resize-none bg-transparent px-2.5 pt-1 pb-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-hidden disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-[160px] leading-relaxed"
          {...props}
        />

        <div className="flex items-center justify-between pt-1 px-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/75 select-none">
            <span className="hidden sm:inline-block font-mono text-[10px]">
              <kbd className="rounded bg-muted px-1.5 py-0.5 border text-foreground/70">Enter</kbd> enviar · <kbd className="rounded bg-muted px-1.5 py-0.5 border text-foreground/70">Shift+Enter</kbd> salto
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isGenerating ? (
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                onClick={onStop}
                className="size-8 rounded-xl shadow-xs"
                title="Detener respuesta"
                aria-label="Detener respuesta"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="default"
                disabled={!hasContent || disabled}
                onClick={onSubmit}
                className="size-8 rounded-xl shadow-xs transition-all"
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
              >
                <CornerDownLeft className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
