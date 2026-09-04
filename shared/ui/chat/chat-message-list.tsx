'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { ScrollArea } from '@/shared/ui/scroll-area';

export interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
  smoothScroll?: boolean;
}

export const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="chat-message-list"
        className={cn(
          'flex flex-1 flex-col gap-4 overflow-y-auto p-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ChatMessageList.displayName = 'ChatMessageList';
