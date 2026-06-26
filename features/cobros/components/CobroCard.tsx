'use client';

import { Check, X } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { formatPeso, formatHora } from '@/shared/lib/format';
import { metodoInfo } from '@/features/cobros/metodos';
import type { TransaccionCobro } from '@/features/cobros/types';

export function CobroCard({
    tx,
    onAprobar,
    onRechazar,
}: {
    tx: TransaccionCobro;
    onAprobar: (tx: TransaccionCobro) => void;
    onRechazar: (tx: TransaccionCobro) => void;
}) {
    const metodo = metodoInfo(tx.proveedor);
    const descuento = Number(tx.descuento);

    return (
        <Card className="gap-0 p-5">
            {/* Cabecera: mesa + hora a la izquierda, icono del método a la derecha */}
            <div className="flex items-start justify-between">
                <div>
                    <Badge variant="secondary" className="font-medium">
                        Mesa {tx.mesaIdentificador}
                    </Badge>
                    <p className="mt-2 text-sm text-muted-foreground">{formatHora(tx.fecha)} hs</p>
                </div>
                <div className={`flex size-10 items-center justify-center rounded-lg ${metodo.iconBox}`}>
                    <metodo.Icon className="size-5" />
                </div>
            </div>

            {/* Método solicitado */}
            <div className="mt-5">
                <p className="text-sm text-muted-foreground">Quiere pagar con</p>
                <p className="text-lg font-semibold text-foreground">{metodo.label}</p>
            </div>

            {/* Total a cobrar */}
            <div className="mt-5 rounded-lg bg-muted px-4 py-3">
                {descuento > 0 && (
                    <div className="mb-1 flex items-center justify-between text-sm text-success-foreground">
                        <span>Descuento aplicado</span>
                        <span className="font-medium tabular-nums">− {formatPeso(descuento)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total a cobrar</span>
                    <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                        {formatPeso(tx.monto)}
                    </span>
                </div>
            </div>

            {/* Acciones */}
            <div className="mt-5 flex gap-2">
                <Button size="lg" className="flex-1" onClick={() => onAprobar(tx)}>
                    <Check className="size-4" />
                    Aprobar cobro
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onRechazar(tx)}
                    aria-label="Rechazar cobro"
                    title="Rechazar y mantener la mesa abierta"
                >
                    <X className="size-4" />
                </Button>
            </div>
        </Card>
    );
}
