import { Drone, _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { DroneStatus } from '../../src/domain/types';
import { Order } from '../../src/domain/Order';
import { Priority } from '../../src/domain/types';

function makeDrone(overrides: Partial<{ maxWeightKg: number; maxRangeKm: number }> = {}) {
  return new Drone({
    maxWeightKg: overrides.maxWeightKg ?? 5,
    maxRangeKm: overrides.maxRangeKm ?? 10,
  });
}

describe('Drone', () => {
  beforeEach(() => {
    _resetDroneSequenceForTests();
  });

  it('inicia no estado Idle, com bateria cheia', () => {
    const drone = makeDrone();
    expect(drone.status).toBe(DroneStatus.IDLE);
    expect(drone.batteryPercent).toBe(100);
    expect(drone.isAvailable).toBe(true);
  });

  describe('canCarry / canFly', () => {
    it('aceita carga dentro da capacidade máxima', () => {
      const drone = makeDrone({ maxWeightKg: 5 });
      expect(drone.canCarry(5)).toBe(true);
      expect(drone.canCarry(5.01)).toBe(false);
    });

    it('aceita distância dentro do alcance máximo', () => {
      const drone = makeDrone({ maxRangeKm: 10 });
      expect(drone.canFly(10)).toBe(true);
      expect(drone.canFly(10.01)).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('permite a sequência de transições válida do fluxo de entrega', () => {
      const drone = makeDrone();
      expect(() => drone.transitionTo(DroneStatus.IN_FLIGHT)).not.toThrow();
      expect(() => drone.transitionTo(DroneStatus.DELIVERING)).not.toThrow();
      expect(() => drone.transitionTo(DroneStatus.RETURNING)).not.toThrow();
      expect(() => drone.transitionTo(DroneStatus.IDLE)).not.toThrow();
      expect(drone.status).toBe(DroneStatus.IDLE);
    });

    it('permite ciclo de múltiplas entregas antes de retornar', () => {
      const drone = makeDrone();
      drone.transitionTo(DroneStatus.IN_FLIGHT);
      drone.transitionTo(DroneStatus.DELIVERING);
      drone.transitionTo(DroneStatus.IN_FLIGHT); // vai para o próximo ponto
      drone.transitionTo(DroneStatus.DELIVERING);
      expect(() => drone.transitionTo(DroneStatus.RETURNING)).not.toThrow();
    });

    it('rejeita transição inválida (ex: Idle -> Entregando direto)', () => {
      const drone = makeDrone();
      expect(() => drone.transitionTo(DroneStatus.DELIVERING)).toThrow(/Transição inválida/);
    });

    it('rejeita transição inválida (ex: Em voo -> Retornando direto)', () => {
      const drone = makeDrone();
      drone.transitionTo(DroneStatus.IN_FLIGHT);
      expect(() => drone.transitionTo(DroneStatus.RETURNING)).toThrow(/Transição inválida/);
    });
  });

  describe('flyDistance / bateria', () => {
    it('consome bateria proporcionalmente à distância percorrida', () => {
      const drone = makeDrone({ maxRangeKm: 10 }); // 10% de bateria por km
      drone.flyDistance(5);
      expect(drone.batteryPercent).toBeCloseTo(50, 5);
      expect(drone.totalDistanceFlownKm).toBe(5);
    });

    it('lança erro ao tentar voar além do alcance restante', () => {
      const drone = makeDrone({ maxRangeKm: 10 });
      drone.flyDistance(8);
      expect(() => drone.flyDistance(5)).toThrow(/não tem alcance\/bateria suficiente/);
    });

    it('recharge() restaura a bateria para 100% e volta para Idle', () => {
      const drone = makeDrone({ maxRangeKm: 10 });
      drone.flyDistance(9);
      drone.transitionTo(DroneStatus.IN_FLIGHT);
      drone.transitionTo(DroneStatus.DELIVERING);
      drone.transitionTo(DroneStatus.RETURNING);
      drone.transitionTo(DroneStatus.IDLE);

      drone.recharge();
      expect(drone.batteryPercent).toBe(100);
      expect(drone.status).toBe(DroneStatus.IDLE);
    });
  });

  describe('assignOrders / completeDeliveries', () => {
    it('associa pedidos ao drone e marca-os como entregues ao completar', () => {
      const drone = makeDrone();
      const order = new Order({ location: { x: 1, y: 1 }, weightKg: 1, priority: Priority.LOW });

      drone.assignOrders([order]);
      expect(order.assignedDroneId).toBe(drone.id);
      expect(drone.assignedOrders).toHaveLength(1);

      drone.completeDeliveries();
      expect(drone.totalDeliveries).toBe(1);
      expect(drone.assignedOrders).toHaveLength(0);
    });
  });
});
