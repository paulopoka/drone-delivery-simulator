import { Order } from '../domain/Order';
import { Drone, DroneSpecs } from '../domain/Drone';
import { NoFlyZone } from '../domain/NoFlyZone';
import { RoutePlan } from '../utils/routing';
import { AllocationStrategy, DEFAULT_STRATEGY, UnassignedOrder } from './strategies';

export interface Trip {
  drone: Drone;
  orders: Order[];
  totalWeightKg: number;
  /** Distância real da rota, já contando desvios de zonas de exclusão. */
  distanceKm: number;
  route: RoutePlan;
}

export interface AllocationResult {
  trips: Trip[];
  unassignedOrders: UnassignedOrder[];
}

/**
 * Decide como agrupar pedidos em viagens de drone, minimizando o número de
 * viagens e respeitando capacidade de peso, alcance e zonas de exclusão aérea.
 *
 * O *como* agrupar vive nas estratégias (`./strategies`), que produzem apenas
 * um plano. Este serviço faz a ponte entre o plano e o mundo real: cria um
 * drone para cada viagem planejada. Essa separação é o que permite comparar
 * estratégias sem efeito colateral — ver `StrategyComparisonService`.
 *
 * A estratégia padrão é uma heurística gulosa (First-Fit-Decreasing por
 * prioridade + peso). Não garante o ótimo global — o problema é uma variante de
 * bin-packing + roteamento, NP-difícil — mas produz um número pequeno de
 * viagens em tempo hábil, que é o objetivo prático do desafio.
 */
export class AllocationService {
  constructor(
    private readonly droneSpecs: DroneSpecs,
    private readonly strategy: AllocationStrategy = DEFAULT_STRATEGY
  ) {}

  allocate(orders: Order[], zones: NoFlyZone[] = []): AllocationResult {
    const plan = this.strategy.plan(orders, this.droneSpecs, zones);

    return {
      trips: plan.tripPlans.map((tripPlan) => ({
        drone: new Drone(this.droneSpecs),
        orders: tripPlan.orders,
        totalWeightKg: tripPlan.totalWeightKg,
        distanceKm: tripPlan.distanceKm,
        route: tripPlan.route,
      })),
      unassignedOrders: plan.unassignedOrders,
    };
  }
}
