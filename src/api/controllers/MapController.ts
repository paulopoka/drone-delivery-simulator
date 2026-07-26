import { Request, Response } from 'express';
import { OrderRepository } from '../../repositories/OrderRepository';
import { NoFlyZoneRepository } from '../../repositories/NoFlyZoneRepository';
import { Order } from '../../domain/Order';
import { MAP_LABELS, renderAsciiMap } from '../../utils/asciiMap';

function statusOf(order: Order): string {
  if (order.isDelivered) return 'entregue';
  if (order.assignedDroneId) return `alocado (${order.assignedDroneId})`;
  return 'pendente';
}

export class MapController {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly zoneRepository: NoFlyZoneRepository
  ) {}

  /**
   * Mapa ASCII das entregas. Responde em `text/plain` para ficar legível
   * direto no terminal (`curl localhost:3000/entregas/mapa`).
   */
  render = (_req: Request, res: Response): void => {
    const orders = this.orderRepository.findAll();
    const zones = this.zoneRepository.findAll();

    res.type('text/plain');

    if (orders.length === 0 && zones.length === 0) {
      res.send('Nenhum pedido cadastrado ainda.\nCrie pedidos ou use POST /simulacao/demo.\n');
      return;
    }

    // Pedidos além dos rótulos disponíveis ainda aparecem no mapa (como '+'),
    // mas sem entrada na legenda — melhor que sumirem silenciosamente.
    const points = orders.map((order, index) => ({
      label: MAP_LABELS[index] ?? '+',
      location: order.location,
    }));

    const grid = renderAsciiMap(points, { zones });

    const legend = orders
      .map((order, index) => {
        const label = MAP_LABELS[index] ?? '+';
        const { x, y } = order.location;
        return `  ${label}  ${order.id.padEnd(10)} (${x}, ${y})  ${order.weightKg}kg  ${order.priority}  ${statusOf(order)}`;
      })
      .join('\n');

    const zoneLegend = zones.map(
      (zone) => `  #  ${zone.name} — centro (${zone.center.x}, ${zone.center.y}), raio ${zone.radiusKm}km`
    );

    res.send(
      [
        'MAPA DAS ENTREGAS',
        '',
        grid,
        '',
        `  @  base (0, 0)`,
        legend,
        ...(zoneLegend.length > 0 ? ['', 'ZONAS DE EXCLUSÃO AÉREA', ...zoneLegend] : []),
        '',
        `  *  duas ou mais entregas na mesma célula da grade`,
        '',
      ].join('\n')
    );
  };
}
