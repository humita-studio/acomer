import { describe, expect, it } from 'vitest';
import {
  aforoFisico,
  mejorMesaPara,
  mesasLibresParaVentana,
  rangosSeSolapan,
  type MesaCandidata,
  type ReservaOcupacion,
} from './disponibilidadMesas';

const mesas: MesaCandidata[] = [
  { id: 'm2', identificador: '2', capacidad: 2 },
  { id: 'm4a', identificador: '4A', capacidad: 4 },
  { id: 'm4b', identificador: '4B', capacidad: 4 },
  { id: 'm8', identificador: '8', capacidad: 8 },
];

const base = new Date('2026-07-16T20:00:00.000Z');
const fin90 = new Date(base.getTime() + 90 * 60_000);

function r(
  partial: Partial<ReservaOcupacion> & Pick<ReservaOcupacion, 'personas'>,
): ReservaOcupacion {
  return {
    id: partial.id,
    mesaId: partial.mesaId ?? null,
    personas: partial.personas,
    inicio: partial.inicio ?? base,
    duracionMin: partial.duracionMin ?? 90,
  };
}

describe('rangosSeSolapan', () => {
  it('detecta solape y no-solape en el borde', () => {
    const a0 = new Date('2026-07-16T20:00:00Z');
    const a1 = new Date('2026-07-16T21:30:00Z');
    const b0 = new Date('2026-07-16T21:30:00Z');
    const b1 = new Date('2026-07-16T23:00:00Z');
    expect(rangosSeSolapan(a0, a1, b0, b1)).toBe(false);
    expect(rangosSeSolapan(a0, a1, new Date('2026-07-16T21:00:00Z'), b1)).toBe(true);
  });
});

describe('mesasLibresParaVentana', () => {
  it('devuelve mesas con capacidad suficiente si no hay reservas', () => {
    const libres = mesasLibresParaVentana(mesas, [], base, fin90, 4);
    expect(libres.map((m) => m.id)).toEqual(['m4a', 'm4b', 'm8']);
  });

  it('excluye mesa ya asignada en el mismo horario', () => {
    const libres = mesasLibresParaVentana(
      mesas,
      [r({ id: 'r1', mesaId: 'm4a', personas: 3 })],
      base,
      fin90,
      4,
    );
    expect(libres.map((m) => m.id)).toEqual(['m4b', 'm8']);
  });

  it('reserva sin mesa consume la mesa más chica que le entre (packing)', () => {
    // Grupo de 4 sin mesa → ocupa una de 4 (m4a por orden).
    const libres = mesasLibresParaVentana(
      mesas,
      [r({ id: 'r1', mesaId: null, personas: 4 })],
      base,
      fin90,
      4,
    );
    expect(libres.map((m) => m.id)).toEqual(['m4b', 'm8']);
  });

  it('no deja sobrevender cuando hay varias sin mesa', () => {
    // 4 reservas de 4 personas sin mesa: solo hay 3 mesas de ≥4 (4A, 4B, 8).
    // Una 5ª de 4 no debería tener mesa.
    const prev = [
      r({ id: 'a', personas: 4 }),
      r({ id: 'b', personas: 4 }),
      r({ id: 'c', personas: 4 }),
    ];
    const libres4 = mesasLibresParaVentana(mesas, prev, base, fin90, 4);
    expect(libres4).toHaveLength(0);

    const libres2 = mesasLibresParaVentana(mesas, prev, base, fin90, 2);
    // La de 2 quedó libre (nadie de 4 la usó).
    expect(libres2.map((m) => m.id)).toEqual(['m2']);
  });

  it('ignora la propia reserva al reasignar', () => {
    const libres = mesasLibresParaVentana(
      mesas,
      [r({ id: 'r1', mesaId: 'm4a', personas: 4 })],
      base,
      fin90,
      4,
      'r1',
    );
    expect(libres.map((m) => m.id)).toContain('m4a');
  });

  it('no solapa con reserva de otro horario', () => {
    const tarde = new Date(base.getTime() + 3 * 60 * 60_000);
    const libres = mesasLibresParaVentana(
      mesas,
      [r({ id: 'r1', mesaId: 'm4a', personas: 4, inicio: tarde })],
      base,
      fin90,
      4,
    );
    expect(libres.map((m) => m.id)).toContain('m4a');
  });
});

describe('mejorMesaPara', () => {
  it('elige la más chica que alcanza', () => {
    const libres = mesasLibresParaVentana(mesas, [], base, fin90, 3);
    expect(mejorMesaPara(libres, 3)?.id).toBe('m4a');
  });
});

describe('aforoFisico', () => {
  it('suma capacidades', () => {
    expect(aforoFisico(mesas)).toBe(2 + 4 + 4 + 8);
  });
});
