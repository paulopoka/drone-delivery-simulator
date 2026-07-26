import { AllocationService } from '../../src/services/AllocationService';
import { SimulationService } from '../../src/services/SimulationService';
import { StrategyComparisonService } from '../../src/services/StrategyComparisonService';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { segmentCrossesZone } from '../../src/utils/geometry';
import { Priority } from '../../src/domain/types';

const SPECS = { maxWeightKg: 5, maxRangeKm: 20 };
const PRIORITIES = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];

/**
 * Gerador determinístico (LCG). Usar Math.random() aqui deixaria o teste
 * flaky — uma falha em uma execução não seria reproduzível na seguinte.
 */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

function generateOrders(count: number, seed = 42): Order[] {
  const random = makeRandom(seed);
  const maxRadius = (SPECS.maxRangeKm / 2) * 0.9;

  return Array.from({ length: count }, () => {
    const angle = random() * 2 * Math.PI;
    const radius = random() * maxRadius;
    return new Order({
      location: {
        x: Number((Math.cos(angle) * radius).toFixed(1)),
        y: Number((Math.sin(angle) * radius).toFixed(1)),
      },
      weightKg: Math.max(0.1, Number((random() * SPECS.maxWeightKg * 0.45).toFixed(1))),
      priority: PRIORITIES[Math.floor(random() * PRIORITIES.length)],
    });
  });
}

describe('simulação de carga', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
    _resetZoneSequenceForTests();
  });

  describe.each([50, 200, 500])('com %i pedidos', (count) => {
    it('aloca todos os pedidos sem perder nenhum', () => {
      const orders = generateOrders(count);
      const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(orders);

      const allocatedCount = trips.reduce((sum, t) => sum + t.orders.length, 0);
      expect(allocatedCount + unassignedOrders.length).toBe(count);
    });

    it('respeita peso e alcance em todas as viagens geradas', () => {
      const orders = generateOrders(count);
      const { trips } = new AllocationService(SPECS).allocate(orders);

      trips.forEach((trip) => {
        expect(trip.totalWeightKg).toBeLessThanOrEqual(SPECS.maxWeightKg);
        expect(trip.distanceKm).toBeLessThanOrEqual(SPECS.maxRangeKm);
      });
    });

    it('executa a simulação inteira sem lançar e entrega tudo que foi alocado', () => {
      const orders = generateOrders(count);
      const { trips } = new AllocationService(SPECS).allocate(orders);

      const report = new SimulationService(40).run(trips);

      const allocatedCount = trips.reduce((sum, t) => sum + t.orders.length, 0);
      expect(report.totalDeliveries).toBe(allocatedCount);
      expect(orders.filter((o) => o.isDelivered)).toHaveLength(allocatedCount);
    });

    it('usa menos viagens que o baseline de uma viagem por pedido', () => {
      const orders = generateOrders(count);
      const { trips } = new AllocationService(SPECS).allocate(orders);

      expect(trips.length).toBeLessThan(count);
    });
  });

  it('mantém tempo de execução razoável com 500 pedidos', () => {
    const orders = generateOrders(500);

    const startedAt = process.hrtime.bigint();
    const { trips } = new AllocationService(SPECS).allocate(orders);
    new SimulationService(40).run(trips);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    // Limite generoso: o objetivo é detectar uma regressão de ordem de grandeza
    // (ex: alguém trocar o first-fit por uma busca exaustiva), não medir perf.
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it('a estratégia padrão vence o baseline no comparativo sob carga', () => {
    const orders = generateOrders(200);
    const comparison = new StrategyComparisonService(SPECS).compare(orders);

    const baseline = comparison.results.find((r) => r.strategy === 'uma-viagem-por-pedido')!;
    const ffd = comparison.results.find((r) => r.strategy === 'first-fit-decreasing')!;

    expect(ffd.trips).toBeLessThan(baseline.trips);
    expect(ffd.savingsPercent).toBeGreaterThan(0);
  });

  it('mantém as invariantes sob carga mesmo com zonas de exclusão no mapa', () => {
    const orders = generateOrders(200);
    const zones = [
      new NoFlyZone({ center: { x: 3, y: 3 }, radiusKm: 1.5, name: 'z1' }),
      new NoFlyZone({ center: { x: -4, y: 2 }, radiusKm: 1.2, name: 'z2' }),
      new NoFlyZone({ center: { x: 0, y: -5 }, radiusKm: 1.8, name: 'z3' }),
    ];

    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(orders, zones);
    new SimulationService(40).run(trips);

    // Nada perdido.
    const allocated = trips.reduce((sum, t) => sum + t.orders.length, 0);
    expect(allocated + unassignedOrders.length).toBe(200);

    // E nenhuma rota atravessa zona proibida.
    trips.forEach((trip) => {
      trip.route.legs.forEach((leg) => {
        for (let i = 0; i < leg.path.length - 1; i++) {
          zones.forEach((z) => {
            expect(segmentCrossesZone(leg.path[i], leg.path[i + 1], z)).toBe(false);
          });
        }
      });
    });
  });

  it('não deixa nenhum pedido órfão: todo pedido é entregue ou reportado', () => {
    const orders = generateOrders(300);
    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(orders);
    new SimulationService(40).run(trips);

    orders.forEach((order) => {
      const wasDelivered = order.isDelivered;
      const wasReported = unassignedOrders.some((u) => u.order.id === order.id);
      expect(wasDelivered || wasReported).toBe(true);
    });
  });
});
