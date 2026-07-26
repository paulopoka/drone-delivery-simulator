import { Order } from '../../domain/Order';
import { DroneSpecs } from '../../domain/Drone';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { planRoute } from '../../utils/routing';
import { AllocationPlan, AllocationStrategy, TripPlan, UnassignedOrder } from './types';
import { checkFitsAlone } from './packing';

/**
 * Baseline honesto: nenhum agrupamento, cada pedido vira uma viagem.
 *
 * Não é uma estratégia séria — é a régua. O objetivo principal do desafio é
 * "menor número de viagens possível", então é contra este número que faz
 * sentido medir o ganho real das outras estratégias.
 */
export class OneTripPerOrderStrategy implements AllocationStrategy {
  readonly name = 'uma-viagem-por-pedido';
  readonly description = 'Baseline: cada pedido vira uma viagem, sem nenhum agrupamento.';

  plan(orders: Order[], specs: DroneSpecs, zones: NoFlyZone[] = []): AllocationPlan {
    const tripPlans: TripPlan[] = [];
    const unassignedOrders: UnassignedOrder[] = [];

    for (const order of orders) {
      const problem = checkFitsAlone(order, specs, zones);
      if (problem) {
        unassignedOrders.push({ order, reason: problem });
        continue;
      }

      // checkFitsAlone já garantiu que a rota existe.
      const route = planRoute([order.location], zones)!;
      tripPlans.push({
        orders: [order],
        totalWeightKg: order.weightKg,
        distanceKm: route.distanceKm,
        route,
      });
    }

    return { tripPlans, unassignedOrders };
  }
}
