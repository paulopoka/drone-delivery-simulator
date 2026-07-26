import { Order } from '../../domain/Order';
import { DroneSpecs } from '../../domain/Drone';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { planRoute } from '../../utils/routing';
import { findZoneContaining } from '../../utils/geometry';
import {
  AllocationPlan,
  TripPlan,
  UnassignedOrder,
  UnassignmentReason,
} from './types';

/**
 * Verifica se um pedido é viável sozinho e, se não for, diz o porquê.
 * Pedidos que falham aqui não têm solução possível — nenhum agrupamento os salva.
 */
export function checkFitsAlone(
  order: Order,
  specs: DroneSpecs,
  zones: NoFlyZone[] = []
): UnassignmentReason | null {
  if (order.weightKg > specs.maxWeightKg) return UnassignmentReason.TOO_HEAVY;

  if (findZoneContaining(order.location, zones)) {
    return UnassignmentReason.INSIDE_NO_FLY_ZONE;
  }

  const route = planRoute([order.location], zones);
  if (!route) return UnassignmentReason.UNREACHABLE_DUE_TO_ZONES;
  if (route.distanceKm > specs.maxRangeKm) return UnassignmentReason.OUT_OF_RANGE;

  return null;
}

/** Versão booleana de `checkFitsAlone`, para quem só precisa do sim/não. */
export function fitsAlone(order: Order, specs: DroneSpecs, zones: NoFlyZone[] = []): boolean {
  return checkFitsAlone(order, specs, zones) === null;
}

/**
 * Percorre os pedidos **na ordem recebida** e encaixa cada um na primeira viagem
 * aberta que ainda comporte peso e alcance (First Fit).
 *
 * O empacotamento em si é idêntico para todas as estratégias — o que as
 * diferencia é apenas a ordem em que entregam os pedidos aqui. É por isso que
 * comparar estratégias é comparar critérios de ordenação.
 *
 * Com zonas de exclusão ativas, cada tentativa de encaixe recalcula a rota
 * completa: um pedido só entra numa viagem se a rota resultante continuar
 * viável *e* dentro do alcance depois dos desvios.
 */
export function firstFitPack(
  orders: Order[],
  specs: DroneSpecs,
  zones: NoFlyZone[] = []
): AllocationPlan {
  const tripPlans: TripPlan[] = [];
  const unassignedOrders: UnassignedOrder[] = [];

  for (const order of orders) {
    const soloProblem = checkFitsAlone(order, specs, zones);
    if (soloProblem) {
      unassignedOrders.push({ order, reason: soloProblem });
      continue;
    }

    let placed = false;
    for (const trip of tripPlans) {
      if (trip.totalWeightKg + order.weightKg > specs.maxWeightKg) continue;

      const candidateRoute = planRoute(
        [...trip.orders.map((o) => o.location), order.location],
        zones
      );
      if (!candidateRoute || candidateRoute.distanceKm > specs.maxRangeKm) continue;

      trip.orders.push(order);
      trip.totalWeightKg += order.weightKg;
      trip.distanceKm = candidateRoute.distanceKm;
      trip.route = candidateRoute;
      placed = true;
      break;
    }

    if (!placed) {
      // Já validado por checkFitsAlone acima, então a rota existe.
      const soloRoute = planRoute([order.location], zones)!;
      tripPlans.push({
        orders: [order],
        totalWeightKg: order.weightKg,
        distanceKm: soloRoute.distanceKm,
        route: soloRoute,
      });
    }
  }

  return { tripPlans, unassignedOrders };
}

/** Distância somada de todas as viagens de um plano. */
export function totalPlanDistanceKm(plan: AllocationPlan): number {
  return plan.tripPlans.reduce((sum, trip) => sum + trip.distanceKm, 0);
}
