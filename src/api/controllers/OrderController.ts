import { Request, Response, NextFunction } from 'express';
import { OrderRepository } from '../../repositories/OrderRepository';
import { NoFlyZoneRepository } from '../../repositories/NoFlyZoneRepository';
import { Order } from '../../domain/Order';
import { Priority } from '../../domain/types';
import { validateCreateOrder, ValidationError } from '../validation';
import { droneSpecs } from '../../config';
import { planRoute } from '../../utils/routing';
import { findZoneContaining } from '../../utils/geometry';

export class OrderController {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly zoneRepository: NoFlyZoneRepository
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const body = validateCreateOrder(req.body);
      const zones = this.zoneRepository.findAll();

      if (body.weightKg > droneSpecs.maxWeightKg) {
        throw new ValidationError(
          `Peso do pacote (${body.weightKg}kg) excede a capacidade máxima do drone (${droneSpecs.maxWeightKg}kg).`
        );
      }

      const blockingZone = findZoneContaining(body.location, zones);
      if (blockingZone) {
        throw new ValidationError(
          `Endereço de entrega está dentro da zona de exclusão aérea "${blockingZone.name}".`
        );
      }

      // Rota já considerando desvios: um cliente atrás de uma zona continua
      // atendível, mas o desvio conta para o alcance.
      const route = planRoute([body.location], zones);
      if (!route) {
        throw new ValidationError(
          'Não há rota aérea viável até esse endereço: as zonas de exclusão bloqueiam todos os caminhos.'
        );
      }
      if (route.distanceKm > droneSpecs.maxRangeKm) {
        const detourNote = route.hasDetour ? ' (já contando o desvio de zonas de exclusão)' : '';
        throw new ValidationError(
          `Distância até o cliente (${route.distanceKm.toFixed(2)}km${detourNote}) excede o alcance máximo do drone (${droneSpecs.maxRangeKm}km).`
        );
      }

      const order = new Order({
        location: body.location,
        weightKg: body.weightKg,
        priority: body.priority as Priority,
      });

      this.orderRepository.save(order);

      res.status(201).json({
        id: order.id,
        location: order.location,
        weightKg: order.weightKg,
        priority: order.priority,
        createdAt: order.createdAt,
      });
    } catch (err) {
      next(err);
    }
  };

  list = (_req: Request, res: Response): void => {
    const orders = this.orderRepository.findAll();
    res.json(
      orders.map((o) => ({
        id: o.id,
        location: o.location,
        weightKg: o.weightKg,
        priority: o.priority,
        assignedDroneId: o.assignedDroneId,
        isDelivered: o.isDelivered,
      }))
    );
  };
}
