'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatFechaHora, formatPeso } from '@/shared/lib/format';

export type TicketLinea = {
  nombre: string;
  cantidad: number;
  subtotal: number;
};

export type TicketPrintData = {
  titulo: string;
  subtitulo?: string;
  lineas: TicketLinea[];
  total: number;
  descuento?: number;
  metodo?: string;
  fecha?: Date | string;
  footer?: string;
};

/**
 * Abre una ventana de impresión con un ticket simple (80mm-ish) para caja/comanda.
 */
export function TicketPrintButton({
  ticket,
  label = 'Imprimir ticket',
  variant = 'outline',
  size = 'sm',
}: {
  ticket: TicketPrintData;
  label?: string;
  variant?: 'outline' | 'secondary' | 'default' | 'ghost';
  size?: 'sm' | 'default' | 'icon';
}) {
  const handlePrint = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=360,height=640');
    if (!w) return;

    const rows = ticket.lineas
      .map(
        (l) =>
          `<tr>
            <td>${escapeHtml(String(l.cantidad))}× ${escapeHtml(l.nombre)}</td>
            <td style="text-align:right">${escapeHtml(formatPeso(l.subtotal))}</td>
          </tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; margin: 12px; color: #111; }
    h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
    .sub { text-align: center; color: #444; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 3px 0; vertical-align: top; }
    .tot { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; font-weight: 700; }
    .foot { margin-top: 16px; text-align: center; color: #666; font-size: 10px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(ticket.titulo)}</h1>
  ${ticket.subtitulo ? `<div class="sub">${escapeHtml(ticket.subtitulo)}</div>` : ''}
  <div class="sub">${escapeHtml(formatFechaHora(ticket.fecha ?? new Date()))}</div>
  <table>${rows}</table>
  ${
    ticket.descuento && ticket.descuento > 0
      ? `<div>Descuento: −${escapeHtml(formatPeso(ticket.descuento))}</div>`
      : ''
  }
  <div class="tot">Total: ${escapeHtml(formatPeso(ticket.total))}</div>
  ${ticket.metodo ? `<div>Método: ${escapeHtml(ticket.metodo)}</div>` : ''}
  <div class="foot">${escapeHtml(ticket.footer ?? 'Gracias por tu visita')}</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={handlePrint}>
      <Printer className="size-4" />
      {size !== 'icon' && <span className="ml-1.5">{label}</span>}
    </Button>
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
