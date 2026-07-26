import {
  FirstFitDecreasingStrategy,
  NearestFirstStrategy,
  OneTripPerOrderStrategy,
  ALL_STRATEGIES,
  fitsAlone,
  totalPlanDistanceKm,
} from '../../src/services/strategies';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { Priority } from '../../src/domain/types';

const SPECS = { maxWeightKg: 5, maxRangeKm: 20 };

function order(x: number, y: number, weightKg: number, priority: Priority = Priority.LOW): Order {
  return new Order({ location: { x, y }, weightKg, priority });
}

describe('estratégias de alocação', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
  });

  describe('fitsAlone', () => {
    it('rejeita pedido acima da capacidade de peso', () => {
      expect(fitsAlone(order(1, 1, 99), SPECS)).toBe(false);
    });

    it('rejeita pedido fora do alcance', () => {
      expect(fitsAlone(order(500, 500, 1), SPECS)).toBe(false);
    });

    it('aceita pedido dentro dos dois limites', () => {
      expect(fitsAlone(order(1, 1, 1), SPECS)).toBe(true);
    });
  });

  describe('OneTripPerOrderStrategy (baseline)', () => {
    it('cria exatamente uma viagem por pedido alocável', () => {
      const orders = [order(1, 0, 1), order(1.1, 0, 1), order(1.2, 0, 1)];
      const plan = new OneTripPerOrderStrategy().plan(orders, SPECS);

      expect(plan.tripPlans).toHaveLength(3);
      plan.tripPlans.forEach((t) => expect(t.orders).toHaveLength(1));
    });

    it('separa os não-alocáveis em vez de criar viagem pra eles', () => {
      const plan = new OneTripPerOrderStrategy().plan([order(1, 0, 1), order(999, 999, 1)], SPECS);

      expect(plan.tripPlans).toHaveLength(1);
      expect(plan.unassignedOrders).toHaveLength(1);
    });
  });

  describe('FirstFitDecreasingStrategy', () => {
    it('agrupa pedidos leves e próximos em uma única viagem', () => {
      const orders = [order(1, 0, 1), order(1.2, 0, 1), order(1.4, 0, 1)];
      const plan = new FirstFitDecreasingStrategy().plan(orders, SPECS);

      expect(plan.tripPlans).toHaveLength(1);
      expect(plan.tripPlans[0].orders).toHaveLength(3);
    });

    it('processa alta prioridade antes das demais', () => {
      const low = order(1, 0, 1, Priority.LOW);
      const high = order(2, 0, 1, Priority.HIGH);
      const plan = new FirstFitDecreasingStrategy().plan([low, high], {
        maxWeightKg: 1,
        maxRangeKm: 20,
      });

      expect(plan.tripPlans[0].orders[0].priority).toBe(Priority.HIGH);
    });
  });

  describe('NearestFirstStrategy', () => {
    it('atende primeiro o pedido mais próximo da base', () => {
      const far = order(8, 0, 1);
      const near = order(1, 0, 1);
      const plan = new NearestFirstStrategy().plan([far, near], {
        maxWeightKg: 1,
        maxRangeKm: 20,
      });

      expect(plan.tripPlans[0].orders[0].id).toBe(near.id);
    });
  });

  describe('invariantes válidas para todas as estratégias', () => {
    const orders = [
      order(1, 1, 1, Priority.HIGH),
      order(2, 2, 2, Priority.LOW),
      order(-3, 1, 1.5, Priority.MEDIUM),
      order(4, -2, 0.5, Priority.LOW),
      order(999, 999, 1), // inalcançável
      order(1, 1, 99), // pesado demais
    ];

    it.each(ALL_STRATEGIES.map((s) => [s.name, s] as const))(
      '%s: todo pedido aparece exatamente uma vez, sem perder nem duplicar',
      (_name, strategy) => {
        const plan = strategy.plan(orders, SPECS);
        const ids = [
          ...plan.tripPlans.flatMap((t) => t.orders.map((o) => o.id)),
          ...plan.unassignedOrders.map((u) => u.order.id),
        ];

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.sort()).toEqual(orders.map((o) => o.id).sort());
      }
    );

    it.each(ALL_STRATEGIES.map((s) => [s.name, s] as const))(
      '%s: nenhuma viagem excede peso ou alcance do drone',
      (_name, strategy) => {
        const plan = strategy.plan(orders, SPECS);

        plan.tripPlans.forEach((trip) => {
          expect(trip.totalWeightKg).toBeLessThanOrEqual(SPECS.maxWeightKg);
          expect(trip.distanceKm).toBeLessThanOrEqual(SPECS.maxRangeKm);
        });
      }
    );

    it.each(ALL_STRATEGIES.map((s) => [s.name, s] as const))(
      '%s: planejar não muta os pedidos (sem drone associado, sem entrega marcada)',
      (_name, strategy) => {
        strategy.plan(orders, SPECS);

        orders.forEach((o) => {
          expect(o.assignedDroneId).toBeNull();
          expect(o.isDelivered).toBe(false);
        });
      }
    );
  });

  describe('totalPlanDistanceKm', () => {
    it('soma a distância de todas as viagens do plano', () => {
      const plan = new OneTripPerOrderStrategy().plan([order(3, 4, 1), order(3, 4, 1)], SPECS);
      // cada pedido: ida e volta = 10km
      expect(totalPlanDistanceKm(plan)).toBeCloseTo(20, 5);
    });

    it('retorna 0 para um plano vazio', () => {
      expect(totalPlanDistanceKm({ tripPlans: [], unassignedOrders: [] })).toBe(0);
    });
  });
});
