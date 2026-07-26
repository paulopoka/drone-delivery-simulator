import { Coordinates } from '../domain/types';
import { NoFlyZone } from '../domain/NoFlyZone';
import {
  BASE_LOCATION,
  distance,
  routeDistance,
  findBlockingZone,
  findZoneContaining,
} from './geometry';

/**
 * Ordena os pontos usando a heurística do vizinho mais próximo (Nearest Neighbor),
 * partindo da base. Não é ótimo (TSP é NP-difícil), mas é uma aproximação rápida
 * e suficiente para o tamanho de rotas de um drone (poucos pacotes por viagem).
 */
export function nearestNeighborOrder(points: Coordinates[]): Coordinates[] {
  const remaining = [...points];
  const ordered: Coordinates[] = [];
  let current = BASE_LOCATION;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distance(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    }
    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/** Calcula a distância total de uma rota otimizada (base -> pontos -> base). */
export function optimizedRouteDistance(points: Coordinates[]): number {
  return routeDistance(nearestNeighborOrder(points));
}

/** Um trecho da rota entre dois pontos, já resolvido contra as zonas de exclusão. */
export interface RouteLeg {
  from: Coordinates;
  to: Coordinates;
  /** Caminho efetivamente voado: `[from, ...desvios, to]`. */
  path: Coordinates[];
  distanceKm: number;
  hasDetour: boolean;
}

export interface RoutePlan {
  /** Paradas de entrega, na ordem de visita (sem os waypoints de desvio). */
  orderedStops: Coordinates[];
  /** Trechos na ordem de voo, incluindo o retorno à base. */
  legs: RouteLeg[];
  /** Distância real, já contando os desvios. */
  distanceKm: number;
  hasDetour: boolean;
}

/** Folga aplicada sobre o afastamento mínimo calculado, contra erro numérico. */
const DETOUR_MARGIN = 1.15;

/** Afastamento usado quando a fórmula degenera (ponta praticamente colada na zona). */
const FALLBACK_OFFSET_FACTOR = 4;

/**
 * Afastamento perpendicular mínimo para que o trecho até o waypoint não invada
 * a zona.
 *
 * Derivação: com a ponta do trecho na origem e o centro da zona a uma distância
 * `c` ao longo dele, um waypoint a uma altura `h` perpendicular deixa o centro a
 * `c·h / √(c² + h²)` do novo trecho. Exigindo que isso seja ≥ `r` e isolando:
 *
 *     h ≥ r·c / √(c² − r²)
 *
 * Sem essa conta, um afastamento "que parece suficiente" (ex: 1,08 × raio)
 * ainda raspa o círculo — a reta até o waypoint corta a zona por dentro.
 */
function minimumPerpendicularOffset(distanceAlong: number, radiusKm: number): number {
  const denominator = distanceAlong * distanceAlong - radiusKm * radiusKm;
  if (denominator <= 0) return Infinity;
  return (radiusKm * distanceAlong) / Math.sqrt(denominator);
}

/**
 * Procura um ponto de desvio que contorne a zona bloqueante.
 *
 * Estratégia: sair perpendicularmente ao trecho original, a partir do centro da
 * zona, nos dois sentidos possíveis (contornar "por cima" ou "por baixo"). Cada
 * candidato só vale se os dois novos trechos estiverem livres de *todas* as
 * zonas — não adianta desviar de uma e entrar em outra. Entre os candidatos
 * válidos, vence o mais curto.
 *
 * É um desvio de um waypoint só: resolve o caso comum de uma zona no meio do
 * caminho, mas não é um pathfinding geral. Quando não encontra saída, devolve
 * `null` e quem chamou trata a rota como inviável — melhor recusar de forma
 * explícita do que devolver uma rota que atravessa área proibida.
 */
function findDetourWaypoint(
  from: Coordinates,
  to: Coordinates,
  blockingZone: NoFlyZone,
  zones: NoFlyZone[]
): Coordinates | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;

  const direction = { x: dx / length, y: dy / length };

  // Vetores unitários perpendiculares ao trecho, nos dois sentidos.
  const perpendiculars = [
    { x: -direction.y, y: direction.x },
    { x: direction.y, y: -direction.x },
  ];

  // Projeção do centro da zona sobre o trecho: define o quanto o waypoint
  // precisa se afastar para cada uma das duas metades do desvio.
  const along =
    (blockingZone.center.x - from.x) * direction.x +
    (blockingZone.center.y - from.y) * direction.y;

  const offsetFromStart = minimumPerpendicularOffset(Math.abs(along), blockingZone.radiusKm);
  const offsetFromEnd = minimumPerpendicularOffset(Math.abs(length - along), blockingZone.radiusKm);

  const required = Math.max(offsetFromStart, offsetFromEnd);
  const offset = Number.isFinite(required)
    ? required * DETOUR_MARGIN
    : blockingZone.radiusKm * FALLBACK_OFFSET_FACTOR;

  const candidates = perpendiculars
    .map((perpendicular) => ({
      x: blockingZone.center.x + perpendicular.x * offset,
      y: blockingZone.center.y + perpendicular.y * offset,
    }))
    .filter(
      (candidate) =>
        !findZoneContaining(candidate, zones) &&
        !findBlockingZone(from, candidate, zones) &&
        !findBlockingZone(candidate, to, zones)
    );

  if (candidates.length === 0) return null;

  return candidates.reduce((shortest, candidate) => {
    const candidateCost = distance(from, candidate) + distance(candidate, to);
    const shortestCost = distance(from, shortest) + distance(shortest, to);
    return candidateCost < shortestCost ? candidate : shortest;
  });
}

/**
 * Resolve um trecho entre dois pontos respeitando as zonas de exclusão.
 * Devolve `null` quando o trecho é impossível.
 */
export function planLeg(
  from: Coordinates,
  to: Coordinates,
  zones: NoFlyZone[] = []
): RouteLeg | null {
  // Destino dentro de zona proibida: nenhum desvio resolve, o ponto de entrega
  // em si é inalcançável.
  if (findZoneContaining(to, zones)) return null;
  // Origem dentro de zona (ex: base mal posicionada): idem.
  if (findZoneContaining(from, zones)) return null;

  const blockingZone = findBlockingZone(from, to, zones);

  if (!blockingZone) {
    return {
      from,
      to,
      path: [from, to],
      distanceKm: distance(from, to),
      hasDetour: false,
    };
  }

  const waypoint = findDetourWaypoint(from, to, blockingZone, zones);
  if (!waypoint) return null;

  return {
    from,
    to,
    path: [from, waypoint, to],
    distanceKm: distance(from, waypoint) + distance(waypoint, to),
    hasDetour: true,
  };
}

/**
 * Monta a rota completa (base -> paradas -> base) respeitando as zonas de
 * exclusão, com a ordem de visita definida pelo vizinho mais próximo.
 *
 * Devolve `null` se qualquer trecho for impossível. Sem zonas informadas, o
 * resultado é idêntico ao roteamento em linha reta de sempre.
 *
 * Nota: a ordem das paradas é escolhida ignorando as zonas, e só depois os
 * desvios são calculados. Uma ordem diferente poderia render um desvio menor —
 * mas otimizar ordem e desvio ao mesmo tempo é um problema bem mais caro, e o
 * ganho seria pequeno para o punhado de paradas de uma viagem de drone.
 */
export function planRoute(stops: Coordinates[], zones: NoFlyZone[] = []): RoutePlan | null {
  const orderedStops = nearestNeighborOrder(stops);
  const legs: RouteLeg[] = [];

  let current = BASE_LOCATION;
  for (const stop of orderedStops) {
    const leg = planLeg(current, stop, zones);
    if (!leg) return null;
    legs.push(leg);
    current = stop;
  }

  if (orderedStops.length > 0) {
    const returnLeg = planLeg(current, BASE_LOCATION, zones);
    if (!returnLeg) return null;
    legs.push(returnLeg);
  }

  return {
    orderedStops,
    legs,
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    hasDetour: legs.some((leg) => leg.hasDetour),
  };
}
