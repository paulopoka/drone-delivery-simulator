import { AllocationService } from '../../src/services/AllocationService';
import { SimulationService } from '../../src/services/SimulationService';
import { UnassignmentReason } from '../../src/services/strategies';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { segmentCrossesZone } from '../../src/utils/geometry';
import { Priority } from '../../src/domain/types';

const SPECS = { maxWeightKg: 5, maxRangeKm: 40 };

function order(x: number, y: number, weightKg = 1, priority: Priority = Priority.LOW): Order {
  return new Order({ location: { x, y }, weightKg, priority });
}

function zone(x: number, y: number, radiusKm: number, name = 'zona'): NoFlyZone {
  return new NoFlyZone({ center: { x, y }, radiusKm, name });
}

describe('alocação com zonas de exclusão', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
    _resetZoneSequenceForTests();
  });

  it('reporta pedido dentro de zona como não-alocável, com o motivo correto', () => {
    const blocked = order(10, 0);
    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(
      [blocked],
      [zone(10, 0, 3)]
    );

    expect(trips).toHaveLength(0);
    expect(unassignedOrders).toHaveLength(1);
    expect(unassignedOrders[0].reason).toBe(UnassignmentReason.INSIDE_NO_FLY_ZONE);
    expect(unassignedOrders[0].order.id).toBe(blocked.id);
  });

  it('ainda entrega um cliente que está atrás de uma zona, contornando-a', () => {
    const zones = [zone(5, 0, 2)];
    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(
      [order(10, 0)],
      zones
    );

    expect(unassignedOrders).toHaveLength(0);
    expect(trips).toHaveLength(1);
    expect(trips[0].route.hasDetour).toBe(true);
  });

  it('a rota alocada nunca atravessa uma zona', () => {
    const zones = [zone(4, 0, 1.5), zone(0, 5, 2)];
    const orders = [order(9, 0), order(0, 10), order(-6, -6)];

    const { trips } = new AllocationService(SPECS).allocate(orders, zones);

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

  it('cobra o desvio no alcance: viagem que caberia em linha reta pode não caber com a zona', () => {
    const stops = [order(9, 0)];
    // Alcance apertado: 18.4km. Ida e volta em linha reta = 18km (cabe).
    const tightSpecs = { maxWeightKg: 5, maxRangeKm: 18.4 };

    const semZona = new AllocationService(tightSpecs).allocate(stops, []);
    expect(semZona.trips).toHaveLength(1);

    _resetOrderSequenceForTests();
    const comZona = new AllocationService(tightSpecs).allocate(
      [order(9, 0)],
      [zone(4.5, 0, 2)]
    );

    expect(comZona.trips).toHaveLength(0);
    expect(comZona.unassignedOrders[0].reason).toBe(UnassignmentReason.OUT_OF_RANGE);
  });

  it('sem zonas, o resultado é idêntico ao de antes', () => {
    const orders = [order(1, 0), order(1.5, 0), order(2, 0)];
    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(orders, []);

    expect(trips).toHaveLength(1);
    expect(trips[0].orders).toHaveLength(3);
    expect(unassignedOrders).toHaveLength(0);
    expect(trips[0].route.hasDetour).toBe(false);
  });

  it('a simulação voa a distância do desvio, não a da linha reta', () => {
    const zones = [zone(5, 0, 2)];

    const semZona = new AllocationService(SPECS).allocate([order(10, 0)], []);
    const reportSemZona = new SimulationService(40).run(semZona.trips);

    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();

    const comZona = new AllocationService(SPECS).allocate([order(10, 0)], zones);
    const reportComZona = new SimulationService(40).run(comZona.trips);

    expect(reportComZona.totalDistanceKm).toBeGreaterThan(reportSemZona.totalDistanceKm);
    expect(reportComZona.tripsWithDetour).toBe(1);
    expect(reportSemZona.tripsWithDetour).toBe(0);
  });

  it('o desvio consome bateria de verdade', () => {
    const zones = [zone(5, 0, 2)];

    const semZona = new AllocationService(SPECS).allocate([order(10, 0)], []);
    new SimulationService(40).run(semZona.trips);
    const bateriaSemZona = semZona.trips[0].drone.batteryPercent;

    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();

    const comZona = new AllocationService(SPECS).allocate([order(10, 0)], zones);
    new SimulationService(40).run(comZona.trips);
    const bateriaComZona = comZona.trips[0].drone.batteryPercent;

    expect(bateriaComZona).toBeLessThan(bateriaSemZona);
  });

  it('entrega todos os pedidos viáveis mesmo com várias zonas no mapa', () => {
    const zones = [zone(6, 6, 2), zone(-6, 6, 2), zone(6, -6, 2)];
    const orders = [order(12, 12), order(-12, 12), order(12, -12), order(-12, -12)];

    const { trips, unassignedOrders } = new AllocationService(SPECS).allocate(orders, zones);
    new SimulationService(40).run(trips);

    const entregues = orders.filter((o) => o.isDelivered).length;
    expect(entregues + unassignedOrders.length).toBe(orders.length);
  });
});
