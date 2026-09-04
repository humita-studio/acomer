'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';

// ==========================================
// CHAT BUBBLE (CONTAINER)
// ==========================================
export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'sent' | 'received';
  layout?: 'default' | 'ai';
}

export function ChatBubble({
  className,
  variant = 'received',
  layout = 'default',
  children,
  ...props
}: ChatBubbleProps) {
  return (
    <div
      data-slot="chat-bubble"
      data-variant={variant}
      data-layout={layout}
      className={cn(
        'group relative flex w-full gap-2.5 items-start',
        variant === 'sent' ? 'flex-row-reverse justify-start' : 'flex-row justify-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ==========================================
// CHAT BUBBLE AVATAR
// ==========================================
export interface ChatBubbleAvatarProps {
  src?: string;
  fallback?: React.ReactNode;
  className?: string;
}

export function ChatBubbleAvatar({
  src,
  fallback,
  className,
}: ChatBubbleAvatarProps) {
  return (
    <Avatar className={cn('size-8 shrink-0 rounded-xl border shadow-2xs mt-0.5', className)}>
      {src && <AvatarImage src={src} />}
      <AvatarFallback className="rounded-xl text-xs font-semibold">
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}

// ==========================================
// CHAT BUBBLE MESSAGE
// ==========================================
export interface ChatBubbleMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'sent' | 'received';
  isLoading?: boolean;
}

export function ChatBubbleMessage({
  className,
  variant = 'received',
  isLoading = false,
  children,
  ...props
}: ChatBubbleMessageProps) {
  return (
    <div
      data-slot="chat-bubble-message"
      data-variant={variant}
      className={cn(
        'relative max-w-[88%] sm:max-w-[85%] text-sm transition-all',
        variant === 'sent' && [
          'rounded-2xl rounded-br-xs bg-primary text-primary-foreground px-4 py-2.5 font-normal shadow-2xs leading-relaxed',
        ],
        variant === 'received' && [
          'rounded-2xl rounded-tl-xs bg-card border border-border/70 text-foreground px-4 py-3 shadow-2xs leading-relaxed',
        ],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
          <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
          <span className="size-1.5 rounded-full bg-current animate-bounce" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ==========================================
// CHAT BUBBLE ACTION WRAPPER
// ==========================================
export interface ChatBubbleActionWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'sent' | 'received';
}

export function ChatBubbleActionWrapper({
  className,
  variant = 'received',
  children,
  ...props
}: ChatBubbleActionWrapperProps) {
  return (
    <div
      data-slot="chat-bubble-action-wrapper"
      className={cn(
        'flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity text-muted-foreground',
        variant === 'sent' ? 'justify-end' : 'justify-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ==========================================
// CHAT BUBBLE ACTION
// ==========================================
export interface ChatBubbleActionProps extends React.ComponentProps<typeof Button> {
  icon?: React.ReactNode;
}

export function ChatBubbleAction({
  className,
  icon,
  children,
  ...props
}: ChatBubbleActionProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn(
        'h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors px-2 text-xs',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}

// ==========================================
// CHAT BUBBLE TIMESTAMP
// ==========================================
export function ChatBubbleTimestamp({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('text-[10px] text-muted-foreground/70 select-none px-1', className)}
      {...props}
    >
      {children}
    </span>
  );
}
