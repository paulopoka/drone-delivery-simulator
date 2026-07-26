import { StrategyComparisonService } from '../../src/services/StrategyComparisonService';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { Priority } from '../../src/domain/types';

const SPECS = { maxWeightKg: 5, maxRangeKm: 20 };

function order(x: number, y: number, weightKg: number, priority: Priority = Priority.LOW): Order {
  return new Order({ location: { x, y }, weightKg, priority });
}

describe('StrategyComparisonService', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
  });

  it('retorna resultado vazio quando não há pedidos', () => {
    const comparison = new StrategyComparisonService(SPECS).compare([]);

    expect(comparison.results).toEqual([]);
    expect(comparison.best).toBeNull();
    expect(comparison.ordersConsidered).toBe(0);
  });

  it('avalia todas as estratégias registradas', () => {
    const orders = [order(1, 0, 1), order(1.5, 0, 1), order(2, 0, 1)];
    const comparison = new StrategyComparisonService(SPECS).compare(orders);

    expect(comparison.results).toHaveLength(3);
    expect(comparison.results.map((r) => r.strategy)).toEqual(
      expect.arrayContaining(['uma-viagem-por-pedido', 'nearest-first', 'first-fit-decreasing'])
    );
  });

  it('elege como melhor a estratégia com menos viagens', () => {
    const orders = [order(1, 0, 1), order(1.2, 0, 1), order(1.4, 0, 1), order(1.6, 0, 1)];
    const comparison = new StrategyComparisonService(SPECS).compare(orders);

    const best = comparison.results.find((r) => r.isBest)!;
    const worst = comparison.results.find((r) => r.strategy === 'uma-viagem-por-pedido')!;

    expect(best.trips).toBeLessThanOrEqual(worst.trips);
    expect(comparison.best).toBe(best.strategy);
    expect(comparison.results.filter((r) => r.isBest)).toHaveLength(1);
  });

  it('o baseline economiza zero viagens em relação a si mesmo', () => {
    const orders = [order(1, 0, 1), order(2, 0, 1)];
    const comparison = new StrategyComparisonService(SPECS).compare(orders);
    const baseline = comparison.results.find((r) => r.strategy === 'uma-viagem-por-pedido')!;

    expect(baseline.tripsSavedVsBaseline).toBe(0);
    expect(baseline.savingsPercent).toBe(0);
  });

  it('calcula economia positiva para a estratégia de agrupamento', () => {
    const orders = [order(1, 0, 1), order(1.2, 0, 1), order(1.4, 0, 1)];
    const comparison = new StrategyComparisonService(SPECS).compare(orders);
    const ffd = comparison.results.find((r) => r.strategy === 'first-fit-decreasing')!;

    expect(ffd.trips).toBe(1);
    expect(ffd.tripsSavedVsBaseline).toBe(2);
    expect(ffd.savingsPercent).toBeCloseTo(66.7, 1);
  });

  it('não muta os pedidos comparados (execução a seco)', () => {
    const orders = [order(1, 0, 1), order(2, 0, 1)];
    new StrategyComparisonService(SPECS).compare(orders);

    orders.forEach((o) => {
      expect(o.assignedDroneId).toBeNull();
      expect(o.isDelivered).toBe(false);
    });
  });

  it('não cria drones ao comparar (sem efeito colateral na sequência de ids)', () => {
    const orders = [order(1, 0, 1), order(2, 0, 1)];
    new StrategyComparisonService(SPECS).compare(orders);

    // Se a comparação tivesse criado drones, o próximo drone não seria o de nº 1.
    const { Drone } = require('../../src/domain/Drone');
    expect(new Drone(SPECS).id).toBe('drone-1');
  });

  it('contabiliza pedidos não-alocáveis em todas as estratégias', () => {
    const orders = [order(1, 0, 1), order(999, 999, 1)];
    const comparison = new StrategyComparisonService(SPECS).compare(orders);

    comparison.results.forEach((r) => expect(r.unassignedOrders).toBe(1));
  });
});
