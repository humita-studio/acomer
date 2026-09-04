import type {
  ResenaClienteDto,
  ResenasMetricsDto,
  AspectoCritica,
} from './types';
import { ASPECTOS_LABELS } from './types';

/**
 * Determina si una calificación debe derivarse a Google Maps o retenerse internamente.
 */
export function esDerivableAGoogle(estrellas: number, minEstrellas = 4): boolean {
  return estrellas >= minEstrellas;
}

/**
 * Calcula métricas agregadas a partir del listado de reseñas internas.
 */
export function calcularMetricasResenas(resenas: ResenaClienteDto[]): ResenasMetricsDto {
  if (resenas.length === 0) {
    return {
      promedio: 0,
      total: 0,
      derivadasGoogle: 0,
      privadasNegativas: 0,
      distribucionEstrellas: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      topAspectos: [],
    };
  }

  const total = resenas.length;
  let sumaEstrellas = 0;
  let derivadasGoogle = 0;
  let privadasNegativas = 0;
  const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const aspectosCount: Record<string, number> = {};

  for (const r of resenas) {
    const stars = Math.min(5, Math.max(1, Math.round(r.estrellas)));
    distribucion[stars] = (distribucion[stars] || 0) + 1;
    sumaEstrellas += stars;

    if (r.derivadaAGoogle) {
      derivadasGoogle++;
    } else if (stars <= 3) {
      privadasNegativas++;
    }

    if (Array.isArray(r.aspectos)) {
      for (const a of r.aspectos) {
        aspectosCount[a] = (aspectosCount[a] || 0) + 1;
      }
    }
  }

  const promedio = Number((sumaEstrellas / total).toFixed(1));

  const topAspectos = Object.entries(aspectosCount)
    .map(([aspecto, count]) => ({
      aspecto,
      label: ASPECTOS_LABELS[aspecto as AspectoCritica] || aspecto,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    promedio,
    total,
    derivadasGoogle,
    privadasNegativas,
    distribucionEstrellas: distribucion,
    topAspectos,
  };
}
