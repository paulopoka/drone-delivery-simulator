import { AllocationService } from '../../src/services/AllocationService';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { Priority } from '../../src/domain/types';

function order(x: number, y: number, weightKg: number, priority: Priority = Priority.LOW): Order {
  return new Order({ location: { x, y }, weightKg, priority });
}

describe('AllocationService', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
  });

  describe('regras de capacidade e alcance', () => {
    it('aloca um único pedido em uma única viagem quando cabe tranquilamente', () => {
      const service = new AllocationService({ maxWeightKg: 5, maxRangeKm: 10 });
      const orders = [order(1, 1, 1)];

      const { trips, unassignedOrders } = service.allocate(orders);

      expect(trips).toHaveLength(1);
      expect(trips[0].orders).toHaveLength(1);
      expect(unassignedOrders).toHaveLength(0);
    });

    it('agrupa múltiplos pedidos leves e próximos em uma única viagem', () => {
      const service = new AllocationService({ maxWeightKg: 5, maxRangeKm: 10 });
      const orders = [order(1, 0, 1), order(1.5, 0, 1), order(2, 0, 1)];

      const { trips } = service.allocate(orders);

      expect(trips).toHaveLength(1);
      expect(trips[0].orders).toHaveLength(3);
      expect(trips[0].totalWeightKg).toBe(3);
    });

    it('abre uma nova viagem quando o peso excede a capacidade do drone', () => {
      const service = new AllocationService({ maxWeightKg: 2, maxRangeKm: 50 });
      const orders = [order(1, 0, 1.5), order(1, 0, 1.5)]; // juntos = 3kg > 2kg

      const { trips } = service.allocate(orders);

      expect(trips).toHaveLength(2);
      trips.forEach((trip) => {
        expect(trip.totalWeightKg).toBeLessThanOrEqual(2);
      });
    });

    it('abre uma nova viagem quando a rota excederia o alcance máximo', () => {
      const service = new AllocationService({ maxWeightKg: 50, maxRangeKm: 12 });
      // Pedido 1: ida e volta = 10km (cabe sozinho)
      // Adicionar o pedido 2 (em direção oposta) estouraria o alcance de 12km
      const orders = [order(5, 0, 1), order(-5, 0, 1)];

      const { trips } = service.allocate(orders);

      expect(trips.length).toBeGreaterThanOrEqual(2);
      trips.forEach((trip) => {
        expect(trip.distanceKm).toBeLessThanOrEqual(12);
      });
    });

    it('reporta como não-alocável um pedido que sozinho já excede a capacidade de peso', () => {
      const service = new AllocationService({ maxWeightKg: 5, maxRangeKm: 50 });
      const orders = [order(1, 1, 10)]; // 10kg > 5kg

      const { trips, unassignedOrders } = service.allocate(orders);

      expect(trips).toHaveLength(0);
      expect(unassignedOrders).toHaveLength(1);
      expect(unassignedOrders[0].order.weightKg).toBe(10);
    });

    it('reporta como não-alocável um pedido que sozinho já excede o alcance máximo', () => {
      const service = new AllocationService({ maxWeightKg: 50, maxRangeKm: 5 });
      const orders = [order(100, 100, 1)]; // muito longe

      const { trips, unassignedOrders } = service.allocate(orders);

      expect(trips).toHaveLength(0);
      expect(unassignedOrders).toHaveLength(1);
    });
  });

  describe('minimização do número de viagens', () => {
    it('usa menos viagens do que "uma viagem por pedido" sempre que possível', () => {
      const service = new AllocationService({ maxWeightKg: 5, maxRangeKm: 20 });
      const orders = [
        order(1, 0, 1),
        order(1.2, 0, 1),
        order(1.4, 0, 1),
        order(1.6, 0, 1),
        order(1.8, 0, 1),
      ];

      const { trips } = service.allocate(orders);

      expect(trips.length).toBeLessThan(orders.length);
    });
  });

  describe('prioridade', () => {
    it('processa pedidos de alta prioridade antes dos demais na ordenação interna', () => {
      const service = new AllocationService({ maxWeightKg: 1, maxRangeKm: 50 });
      const low = order(1, 0, 1, Priority.LOW);
      const high = order(2, 0, 1, Priority.HIGH);

      // Capacidade de 1kg por viagem força uma viagem por pedido;
      // isso nos permite inspecionar a ordem de alocação das viagens.
      const { trips } = service.allocate([low, high]);

      expect(trips).toHaveLength(2);
      expect(trips[0].orders[0].priority).toBe(Priority.HIGH);
      expect(trips[1].orders[0].priority).toBe(Priority.LOW);
    });
  });

  describe('integridade', () => {
    it('todo pedido de entrada aparece ou em uma viagem ou em unassignedOrders, sem duplicar', () => {
      const service = new AllocationService({ maxWeightKg: 3, maxRangeKm: 15 });
      const orders = [
        order(1, 1, 1),
        order(2, 2, 2),
        order(-1, -1, 0.5),
        order(50, 50, 1), // inalcançável
        order(3, 0, 4), // acima da capacidade sozinho
      ];

      const { trips, unassignedOrders } = service.allocate(orders);

      const allocatedIds = trips.flatMap((t) => t.orders.map((o) => o.id));
      const unassignedIds = unassignedOrders.map((u) => u.order.id);
      const allIds = [...allocatedIds, ...unassignedIds];

      expect(new Set(allIds).size).toBe(allIds.length); // sem duplicatas
      expect(allIds.sort()).toEqual(orders.map((o) => o.id).sort());
    });
  });
});
