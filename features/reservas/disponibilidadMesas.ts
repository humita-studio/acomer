/**
 * Disponibilidad de mesas para reservas: solapes + packing greedy.
 *
 * Una reserva sin mesa asignada igual "consume" aforo: se le asigna
 * virtualmente la mesa más chica que le entre, en orden de mayor a menor
 * grupo. Así no se sobrevende aunque el staff todavía no haya sentado.
 */

export type MesaCandidata = {
  id: string;
  identificador: string;
  capacidad: number;
};

export type ReservaOcupacion = {
  id?: string;
  mesaId: string | null;
  personas: number;
  inicio: Date;
  duracionMin: number;
};

export function rangosSeSolapan(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date) {
  return aInicio < bFin && bInicio < aFin;
}

/**
 * Mesas libres (capacidad >= personas) para [inicio, fin), descontando
 * reservas vigentes que se solapan. `excluirReservaId` permite reasignar
 * sin que la propia reserva se bloquee a sí misma.
 */
export function mesasLibresParaVentana(
  candidatas: MesaCandidata[],
  reservas: ReservaOcupacion[],
  inicio: Date,
  fin: Date,
  personas: number,
  excluirReservaId?: string | null,
): MesaCandidata[] {
  if (personas < 1 || candidatas.length === 0) return [];

  const solapadas = reservas.filter((r) => {
    if (excluirReservaId && r.id && r.id === excluirReservaId) return false;
    const rIni = new Date(r.inicio);
    const rFin = new Date(rIni.getTime() + Math.max(1, r.duracionMin || 90) * 60_000);
    return rangosSeSolapan(inicio, fin, rIni, rFin);
  });

  const ocupadas = new Set<string>();
  for (const r of solapadas) {
    if (r.mesaId) ocupadas.add(r.mesaId);
  }

  // Packing de reservas sin mesa: de más personas a menos, mesa más chica que entre.
  const sinMesa = solapadas
    .filter((r) => !r.mesaId)
    .sort((a, b) => b.personas - a.personas || a.personas - b.personas);

  const porCapAsc = [...candidatas]
    .filter((m) => !ocupadas.has(m.id))
    .sort((a, b) => a.capacidad - b.capacidad || a.identificador.localeCompare(b.identificador));

  const libres = porCapAsc.map((m) => m.id);
  for (const r of sinMesa) {
    const idx = libres.findIndex((id) => {
      const mesa = candidatas.find((c) => c.id === id);
      return mesa != null && mesa.capacidad >= r.personas;
    });
    if (idx === -1) {
      // Ya hay overbook virtual: no liberamos mesas extra.
      continue;
    }
    libres.splice(idx, 1);
  }

  const libreSet = new Set(libres);
  return candidatas
    .filter((m) => libreSet.has(m.id) && m.capacidad >= personas)
    .sort((a, b) => a.capacidad - b.capacidad || a.identificador.localeCompare(b.identificador));
}

/** Mejor mesa (más chica que alcanza) o null. */
export function mejorMesaPara(
  libres: MesaCandidata[],
  personas: number,
): MesaCandidata | null {
  const fit = libres
    .filter((m) => m.capacidad >= personas)
    .sort((a, b) => a.capacidad - b.capacidad || a.identificador.localeCompare(b.identificador));
  return fit[0] ?? null;
}

/** Suma de capacidades de mesas raíz (aforo físico del salón). */
export function aforoFisico(mesas: MesaCandidata[]): number {
  return mesas.reduce((s, m) => s + Math.max(0, m.capacidad), 0);
}
