import { Request, Response } from 'express';
import { DeliveryController } from '../../src/api/controllers/DeliveryController';
import {
  InMemoryOrderRepository,
  InMemoryDroneRepository,
  InMemoryNoFlyZoneRepository,
} from '../../src/repositories';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { UnassignmentReason } from '../../src/services/strategies';
import { Priority } from '../../src/domain/types';

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('DeliveryController', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetZoneSequenceForTests();
  });

  // OrderController.create já rejeita (400) qualquer pedido que sozinho
  // exceda peso/alcance antes de ele chegar ao repositório — por isso,
  // pela API pública, `unassignedOrders` nunca fica populado. Este teste
  // simula a única forma de isso acontecer hoje: um pedido inserido direto
  // no repositório sem passar por aquela validação (ex: script/import
  // futuro), confirmando que o relatório final continua reportando-o em vez
  // de descartá-lo silenciosamente.
  it('reporta em unassignedOrders um pedido que não passou pela validação de admissão da API', () => {
    const orderRepository = new InMemoryOrderRepository();
    const droneRepository = new InMemoryDroneRepository();
    const impossibleOrder = new Order({
      location: { x: 1, y: 1 },
      weightKg: 999_999,
      priority: Priority.LOW,
    });
    orderRepository.save(impossibleOrder);

    const controller = new DeliveryController(
      orderRepository,
      droneRepository,
      new InMemoryNoFlyZoneRepository()
    );
    const res = makeRes();
    const next = jest.fn();

    controller.planAndExecuteRoutes({} as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        trips: [],
        unassignedOrders: [
          expect.objectContaining({
            id: impossibleOrder.id,
            reasonCode: UnassignmentReason.TOO_HEAVY,
          }),
        ],
      })
    );
  });

  it('explica que o pedido está dentro de uma zona de exclusão aérea', () => {
    const orderRepository = new InMemoryOrderRepository();
    const zoneRepository = new InMemoryNoFlyZoneRepository();

    const blockedOrder = new Order({
      location: { x: 5, y: 0 },
      weightKg: 1,
      priority: Priority.LOW,
    });
    orderRepository.save(blockedOrder);
    zoneRepository.save(new NoFlyZone({ center: { x: 5, y: 0 }, radiusKm: 2, name: 'aeroporto' }));

    const controller = new DeliveryController(
      orderRepository,
      new InMemoryDroneRepository(),
      zoneRepository
    );
    const res = makeRes();

    controller.planAndExecuteRoutes({} as Request, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        trips: [],
        unassignedOrders: [
          expect.objectContaining({ reasonCode: UnassignmentReason.INSIDE_NO_FLY_ZONE }),
        ],
      })
    );
  });
});
