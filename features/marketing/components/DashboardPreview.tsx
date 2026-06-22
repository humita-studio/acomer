/**
 * Mockup decorativo del panel (no es un dato real): una representación abstracta
 * del dashboard del admin para el hero. Marcado como aria-hidden porque es pura
 * ilustración. Usa tokens del DS para adaptarse a light/dark.
 */
export function DashboardPreview() {
  const barras = [38, 56, 44, 72, 60, 88, 70, 96, 64, 80, 52, 68];

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xl"
    >
      {/* Barra de ventana */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 h-4 flex-1 rounded bg-background/60" />
      </div>

      <div className="grid grid-cols-[88px_1fr] gap-0">
        {/* Sidebar */}
        <div className="hidden flex-col gap-2 border-r border-border bg-muted/30 p-3 sm:flex">
          <div className="mb-1 h-3 w-12 rounded bg-primary/70" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 rounded ${i === 0 ? 'w-full bg-primary/30' : 'w-10 bg-border'}`}
            />
          ))}
        </div>

        {/* Contenido */}
        <div className="space-y-4 p-4">
          {/* Tarjetas de métricas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Ventas', value: '$ 184.500' },
              { label: 'Pedidos', value: '37' },
              { label: 'Ticket prom.', value: '$ 4.980' },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="text-[10px] font-medium text-muted-foreground">
                  {m.label}
                </div>
                <div className="mt-1 font-display text-sm font-semibold text-foreground sm:text-base">
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico de barras */}
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-border" />
              <div className="h-2.5 w-14 rounded bg-border" />
            </div>
            <div className="flex h-24 items-end gap-1.5">
              {barras.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
