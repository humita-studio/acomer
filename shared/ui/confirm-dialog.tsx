'use client';

import * as React from 'react';
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
import { Label } from '@/shared/ui/label';

type ConfirmOptions = {
  titulo: string;
  descripcion?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo destructivo para el botón de confirmar (eliminar, liberar, etc.). */
  destructivo?: boolean;
};

/**
 * Reemplazo estilado del `confirm()` nativo. Devuelve una promesa que resuelve
 * `true` (confirmó) o `false` (canceló / cerró).
 *
 *   const { confirm, dialog } = useConfirm();
 *   const onDelete = async () => {
 *     if (await confirm({ titulo: '¿Eliminar?', destructivo: true })) { ... }
 *   };
 *   return <>{dialog}<button onClick={onDelete}>…</button></>;
 */
export function useConfirm() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolver = React.useRef<(v: boolean) => void>(() => {});

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cerrar = (valor: boolean) => {
    resolver.current(valor);
    setOpts(null);
  };

  const dialog = (
    <Dialog open={opts !== null} onOpenChange={(abierto) => { if (!abierto) cerrar(false); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{opts?.titulo}</DialogTitle>
          {opts?.descripcion ? <DialogDescription>{opts.descripcion}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            {opts?.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button variant={opts?.destructivo ? 'destructive' : 'default'} onClick={() => cerrar(true)}>
            {opts?.confirmLabel ?? 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}

type PromptOptions = {
  titulo: string;
  descripcion?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  tipo?: 'text' | 'number';
};

/**
 * Reemplazo estilado del `prompt()` nativo. Resuelve con el valor ingresado, o
 * `null` si se cancela / cierra. Enter confirma.
 */
export function usePrompt() {
  const [opts, setOpts] = React.useState<PromptOptions | null>(null);
  const [valor, setValor] = React.useState('');
  const resolver = React.useRef<(v: string | null) => void>(() => {});

  const prompt = React.useCallback((options: PromptOptions) => {
    setOpts(options);
    setValor(options.defaultValue ?? '');
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cerrar = (v: string | null) => {
    resolver.current(v);
    setOpts(null);
  };

  const dialog = (
    <Dialog open={opts !== null} onOpenChange={(abierto) => { if (!abierto) cerrar(null); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <form onSubmit={(e) => { e.preventDefault(); cerrar(valor); }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{opts?.titulo}</DialogTitle>
            {opts?.descripcion ? <DialogDescription>{opts.descripcion}</DialogDescription> : null}
          </DialogHeader>
          <div className="grid gap-2">
            {opts?.label ? <Label htmlFor="prompt-input">{opts.label}</Label> : null}
            <Input
              id="prompt-input"
              type={opts?.tipo ?? 'text'}
              value={valor}
              placeholder={opts?.placeholder}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cerrar(null)}>
              Cancelar
            </Button>
            <Button type="submit">{opts?.confirmLabel ?? 'Aceptar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { prompt, dialog };
}
