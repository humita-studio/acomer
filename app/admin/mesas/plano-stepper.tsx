'use client';

/** Control numérico +/- usado por los paneles de edición de mesa y elemento. */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onDec}
          className="w-8 h-8 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-lg leading-none"
        >
          −
        </button>
        <span className="flex-1 text-center font-semibold text-gray-800">{value}</span>
        <button
          onClick={onInc}
          className="w-8 h-8 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}
