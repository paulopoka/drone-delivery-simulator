import { Order } from '../domain/Order';
import { DroneSpecs } from '../domain/Drone';
import { NoFlyZone } from '../domain/NoFlyZone';
import { ALL_STRATEGIES, AllocationStrategy, totalPlanDistanceKm } from './strategies';

export interface StrategyResult {
  strategy: string;
  description: string;
  trips: number;
  totalDistanceKm: number;
  unassignedOrders: number;
  /** Viagens economizadas em relação ao baseline "uma viagem por pedido". */
  tripsSavedVsBaseline: number;
  savingsPercent: number;
  isBest: boolean;
}

export interface StrategyComparison {
  ordersConsidered: number;
  results: StrategyResult[];
  best: string | null;
}

/**
 * Roda os mesmos pedidos por várias estratégias de alocação e devolve um
 * comparativo. Serve para justificar com número — e não só com argumento — por
 * que a estratégia padrão foi escolhida.
 *
 * É uma execução "a seco": as estratégias apenas planejam, então nada aqui cria
 * drones nem muta os pedidos. Chamar este serviço não interfere no estado da
 * simulação.
 */
export class StrategyComparisonService {
  constructor(
    private readonly droneSpecs: DroneSpecs,
    private readonly strategies: AllocationStrategy[] = ALL_STRATEGIES
  ) {}

  compare(orders: Order[], zones: NoFlyZone[] = []): StrategyComparison {
    if (orders.length === 0) {
      return { ordersConsidered: 0, results: [], best: null };
    }

    const raw = this.strategies.map((strategy) => {
      const plan = strategy.plan(orders, this.droneSpecs, zones);
      return {
        strategy: strategy.name,
        description: strategy.description,
        trips: plan.tripPlans.length,
        totalDistanceKm: Number(totalPlanDistanceKm(plan).toFixed(2)),
        unassignedOrders: plan.unassignedOrders.length,
      };
    });

    // O baseline é o pior caso possível: uma viagem por pedido alocável.
    // Calculado a partir dos próprios pedidos para não depender da ordem em
    // que as estratégias foram registradas.
    const baselineTrips = Math.max(...raw.map((r) => r.trips));

    // Menos viagens é o objetivo principal do desafio; distância só desempata.
    const ranked = [...raw].sort((a, b) => a.trips - b.trips || a.totalDistanceKm - b.totalDistanceKm);
    const bestName = ranked[0].strategy;

    const results: StrategyResult[] = raw.map((r) => ({
      ...r,
      tripsSavedVsBaseline: baselineTrips - r.trips,
      savingsPercent:
        baselineTrips > 0 ? Number((((baselineTrips - r.trips) / baselineTrips) * 100).toFixed(1)) : 0,
      isBest: r.strategy === bestName,
    }));

    return { ordersConsidered: orders.length, results, best: bestName };
  }
}
