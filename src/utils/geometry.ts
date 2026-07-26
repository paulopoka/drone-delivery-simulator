import { Coordinates } from '../domain/types';
import { NoFlyZone } from '../domain/NoFlyZone';

export const BASE_LOCATION: Coordinates = { x: 0, y: 0 };

/** Distância euclidiana entre dois pontos, em km (unidade da malha). */
export function distance(a: Coordinates, b: Coordinates): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Menor distância entre um ponto e um **segmento** de reta (não a reta
 * infinita). Projeta o ponto sobre o segmento e limita a projeção ao intervalo
 * [0,1], de forma que, se o pé da perpendicular cair fora do segmento, a
 * distância medida é até a extremidade mais próxima.
 *
 * É a conta que sustenta toda a detecção de zona de exclusão: um trecho de voo
 * cruza uma zona circular exatamente quando esta distância é menor que o raio.
 */
export function distancePointToSegment(
  point: Coordinates,
  segmentStart: Coordinates,
  segmentEnd: Coordinates
): number {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;

  // Segmento degenerado (início == fim): a distância é até o próprio ponto.
  if (lengthSquared === 0) return distance(point, segmentStart);

  const rawT = ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));

  return distance(point, { x: segmentStart.x + t * dx, y: segmentStart.y + t * dy });
}

/**
 * Um ponto está dentro da zona? Usa comparação estrita: estar exatamente sobre
 * a borda é permitido (tangenciar não é invadir).
 */
export function isInsideZone(point: Coordinates, zone: NoFlyZone): boolean {
  return distance(point, zone.center) < zone.radiusKm;
}

/** O ponto cai dentro de alguma das zonas informadas? */
export function findZoneContaining(
  point: Coordinates,
  zones: NoFlyZone[]
): NoFlyZone | undefined {
  return zones.find((zone) => isInsideZone(point, zone));
}

/** O trecho reto entre dois pontos atravessa a zona? */
export function segmentCrossesZone(
  from: Coordinates,
  to: Coordinates,
  zone: NoFlyZone
): boolean {
  return distancePointToSegment(zone.center, from, to) < zone.radiusKm;
}

/** Primeira zona que bloqueia o trecho reto, se houver. */
export function findBlockingZone(
  from: Coordinates,
  to: Coordinates,
  zones: NoFlyZone[]
): NoFlyZone | undefined {
  return zones.find((zone) => segmentCrossesZone(from, to, zone));
}

/**
 * Distância total de uma rota que começa na base, passa por cada ponto
 * na ordem informada, e retorna à base.
 */
export function routeDistance(points: Coordinates[]): number {
  const full = [BASE_LOCATION, ...points, BASE_LOCATION];
  let total = 0;
  for (let i = 0; i < full.length - 1; i++) {
    total += distance(full[i], full[i + 1]);
  }
  return total;
}
