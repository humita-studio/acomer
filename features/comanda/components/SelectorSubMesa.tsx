import Link from 'next/link';

type OpcionSubMesa = {
  id: string;
  identificador: string;
  capacidad: number;
};

/**
 * Pantalla que ve el comensal cuando escanea el QR (impreso) de una mesa que
 * está dividida. Elige su sector y se enruta a `?cuenta=<id>` sobre el mismo QR,
 * así no hace falta que el mozo le muestre un QR distinto por sub-mesa.
 */
export function SelectorSubMesa({
  qrToken,
  opciones,
}: {
  qrToken: string;
  opciones: OpcionSubMesa[];
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-800 text-center mb-1">¿Dónde estás sentado?</h1>
        <p className="text-sm text-gray-500 text-center mb-5">
          Esta mesa está dividida. Elegí tu sector para abrir tu cuenta.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {opciones.map((o) => (
            <Link
              key={o.id}
              href={`/mesa/${qrToken}?cuenta=${o.id}`}
              className="flex flex-col items-center justify-center gap-1 border-2 border-gray-100 rounded-xl py-5 px-3 text-center hover:border-blue-300 hover:bg-blue-50/40 transition"
            >
              <span className="font-bold text-gray-800">{o.identificador}</span>
              <span className="text-xs text-gray-500">{o.capacidad} lugares</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
