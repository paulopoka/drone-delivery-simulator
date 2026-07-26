import { SimulationService } from '../../src/services/SimulationService';
import { AllocationService } from '../../src/services/AllocationService';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { Priority, DroneStatus } from '../../src/domain/types';

function order(x: number, y: number, weightKg: number, priority: Priority = Priority.LOW): Order {
  return new Order({ location: { x, y }, weightKg, priority });
}

describe('SimulationService', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
  });

  it('usa 40km/h como velocidade padrão quando nenhuma é informada', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 20 });
    const { trips } = allocation.allocate([order(8, 0, 1)]);

    const report = new SimulationService().run(trips);

    // base -> (8,0) = 8km, a 40km/h = 12 min até a entrega (ida, sem contar volta)
    expect(report.events[0].etaMinutesFromDispatch).toBe(12);
  });

  it('entrega todos os pedidos de uma viagem simples e o drone volta pra Idle', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 20 });
    const orders = [order(3, 4, 1)];
    const { trips } = allocation.allocate(orders);

    const simulation = new SimulationService(40);
    const report = simulation.run(trips);

    expect(report.totalDeliveries).toBe(1);
    expect(orders[0].isDelivered).toBe(true);
    expect(trips[0].drone.status).toBe(DroneStatus.IDLE);
  });

  it('entrega todos os pedidos de uma viagem com múltiplas paradas', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 30 });
    const orders = [order(1, 0, 1), order(2, 0, 1), order(3, 0, 1)];
    const { trips } = allocation.allocate(orders);

    const simulation = new SimulationService(40);
    const report = simulation.run(trips);

    expect(report.totalDeliveries).toBe(3);
    orders.forEach((o) => expect(o.isDelivered).toBe(true));
  });

  it('calcula a distância total consistente com as viagens simuladas', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 20 });
    const orders = [order(3, 4, 1)]; // ida e volta = 10km
    const { trips } = allocation.allocate(orders);

    const report = new SimulationService(40).run(trips);

    expect(report.totalDistanceKm).toBeCloseTo(10, 5);
  });

  it('atualiza o contador de entregas do drone corretamente', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 30 });
    const orders = [order(1, 0, 1), order(2, 0, 1)];
    const { trips } = allocation.allocate(orders);

    new SimulationService(40).run(trips);

    expect(trips[0].drone.totalDeliveries).toBe(2);
  });

  it('recarrega automaticamente o drone se a bateria não for suficiente para a rota', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 20 });
    const orders = [order(5, 0, 1)]; // ida e volta = 10km
    const { trips } = allocation.allocate(orders);

    // Simula um drone que já gastou quase toda a bateria antes dessa viagem
    trips[0].drone.batteryPercent = 5;

    const simulation = new SimulationService(40);
    expect(() => simulation.run(trips)).not.toThrow();
    expect(trips[0].drone.status).toBe(DroneStatus.IDLE);
  });

  it('retorna um relatório com tempo médio de entrega calculado', () => {
    const allocation = new AllocationService({ maxWeightKg: 5, maxRangeKm: 30 });
    const orders = [order(4, 0, 1), order(8, 0, 1)];
    const { trips } = allocation.allocate(orders);

    const report = new SimulationService(60).run(trips); // 60km/h = 1km/min

    expect(report.averageDeliveryTimeMinutes).toBeGreaterThan(0);
    expect(report.events).toHaveLength(2);
    report.events.forEach((e) => {
      expect(e.etaMinutesFromDispatch).toBeGreaterThan(0);
    });
  });

  it('retorna relatório vazio quando não há viagens', () => {
    const report = new SimulationService(40).run([]);
    expect(report.totalTrips).toBe(0);
    expect(report.totalDeliveries).toBe(0);
    expect(report.averageDeliveryTimeMinutes).toBe(0);
  });
});
