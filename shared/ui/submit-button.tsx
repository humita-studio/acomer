'use client';

import { useFormStatus } from 'react-dom';
import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
};

export function SubmitButton({ children, pendingText = 'Cargando...', ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={pending || props.disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
