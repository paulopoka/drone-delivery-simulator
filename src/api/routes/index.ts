import { Router } from 'express';
import { OrderRepository } from '../../repositories/OrderRepository';
import { DroneRepository } from '../../repositories/DroneRepository';
import { NoFlyZoneRepository } from '../../repositories/NoFlyZoneRepository';
import { OrderController } from '../controllers/OrderController';
import { DeliveryController } from '../controllers/DeliveryController';
import { DroneController } from '../controllers/DroneController';
import { MapController } from '../controllers/MapController';
import { DemoController } from '../controllers/DemoController';
import { NoFlyZoneController } from '../controllers/NoFlyZoneController';

export function buildRouter(
  orderRepository: OrderRepository,
  droneRepository: DroneRepository,
  zoneRepository: NoFlyZoneRepository
): Router {
  const router = Router();

  const orderController = new OrderController(orderRepository, zoneRepository);
  const deliveryController = new DeliveryController(
    orderRepository,
    droneRepository,
    zoneRepository
  );
  const droneController = new DroneController(droneRepository);
  const mapController = new MapController(orderRepository, zoneRepository);
  const demoController = new DemoController(orderRepository);
  const zoneController = new NoFlyZoneController(zoneRepository, orderRepository);

  router.post('/pedidos', orderController.create);
  router.get('/pedidos', orderController.list);

  router.get('/entregas/rota', deliveryController.planAndExecuteRoutes);
  router.get('/entregas/mapa', mapController.render);
  router.get('/entregas/comparar-estrategias', deliveryController.compareStrategies);

  router.get('/drones/status', droneController.list);

  router.post('/zonas-exclusao', zoneController.create);
  router.get('/zonas-exclusao', zoneController.list);
  router.delete('/zonas-exclusao/:id', zoneController.remove);

  router.post('/simulacao/demo', demoController.seed);

  return router;
}
