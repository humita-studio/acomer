/**
 * Mockup decorativo (aria-hidden) del menú del comensal en el celular: cabecera de
 * mesa, pills de categorías, lista de platos y carrito flotante. Ilustra el flujo
 * de "pedir desde la mesa". Tokens del DS para light/dark.
 */
export function PhonePreview() {
  const platos = [
    { nombre: 'Milanesa napolitana', precio: '$ 6.800' },
    { nombre: 'Bife de chorizo', precio: '$ 9.500' },
    { nombre: 'Pollo grillado', precio: '$ 6.500' },
    { nombre: 'Ravioles de ricota', precio: '$ 5.900' },
  ];

  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-card shadow-2xl"
    >
      {/* Cabecera de mesa */}
      <div className="bg-primary px-4 pb-4 pt-5 text-primary-foreground">
        <div className="text-base font-semibold">Mesa 7</div>
        <div className="mt-0.5 text-xs text-primary-foreground/80">
          Sesión compartida · todos ven el mismo pedido
        </div>
      </div>

      {/* Pills de categorías */}
      <div className="flex gap-2 overflow-hidden px-3 py-3">
        {['Entradas', 'Principales', 'Pizzas', 'Pastas'].map((c, i) => (
          <span
            key={c}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${
              i === 1
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      {/* Lista de platos */}
      <div className="space-y-2 px-3 pb-3">
        {platos.map((p) => (
          <div
            key={p.nombre}
            className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <div>
              <div className="text-xs font-medium text-foreground">
                {p.nombre}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-primary">
                {p.precio}
              </div>
            </div>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-sm leading-none text-primary-foreground">
              +
            </span>
          </div>
        ))}
      </div>

      {/* Carrito flotante */}
      <div className="m-3 flex items-center justify-between rounded-lg bg-foreground px-3 py-2.5 text-background">
        <span className="text-xs font-medium">Ver pedido · 3</span>
        <span className="text-sm font-semibold">$ 19.500</span>
      </div>
    </div>
  );
}
