import { Request, Response, NextFunction } from 'express';
import { NoFlyZoneRepository } from '../../repositories/NoFlyZoneRepository';
import { OrderRepository } from '../../repositories/OrderRepository';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { Order } from '../../domain/Order';
import { validateCreateNoFlyZone, ValidationError } from '../validation';
import { BASE_LOCATION, isInsideZone } from '../../utils/geometry';
import { checkFitsAlone, UnassignmentReason } from '../../services/strategies';
import { droneSpecs } from '../../config';

const IMPACT_MESSAGES: Record<UnassignmentReason, string> = {
  [UnassignmentReason.TOO_HEAVY]: 'Peso excede a capacidade máxima do drone.',
  [UnassignmentReason.OUT_OF_RANGE]:
    'O desvio necessário para contornar as zonas passou a exceder o alcance do drone.',
  [UnassignmentReason.INSIDE_NO_FLY_ZONE]: 'Passou a ficar dentro de uma zona de exclusão aérea.',
  [UnassignmentReason.UNREACHABLE_DUE_TO_ZONES]:
    'As zonas de exclusão passaram a bloquear todos os caminhos até o endereço.',
};

export class NoFlyZoneController {
  constructor(
    private readonly zoneRepository: NoFlyZoneRepository,
    private readonly orderRepository: OrderRepository
  ) {}

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const body = validateCreateNoFlyZone(req.body);

      const zone = new NoFlyZone({
        center: body.center,
        radiusKm: body.radiusKm,
        name: body.name,
      });

      // Uma zona sobre a base tornaria toda e qualquer entrega impossível —
      // provavelmente um erro de digitação nas coordenadas, então recusamos com
      // uma mensagem clara em vez de deixar o sistema inteiro travado.
      if (isInsideZone(BASE_LOCATION, zone)) {
        throw new ValidationError(
          `Zona inválida: a área cobriria a base (0, 0), impedindo qualquer decolagem.`
        );
      }

      this.zoneRepository.save(zone);

      // Uma zona nova pode inviabilizar pedidos que já estavam pendentes e eram
      // perfeitamente válidos quando foram criados. A criação não é bloqueada
      // por isso — uma área restrita é um fato externo, não uma escolha do
      // sistema — mas seria ruim descobrir o estrago só ao gerar a rota, então
      // o impacto vem junto na resposta.
      const affectedOrders = this.findNewlyUnfulfillableOrders();

      res.status(201).json({
        id: zone.id,
        name: zone.name,
        center: zone.center,
        radiusKm: zone.radiusKm,
        createdAt: zone.createdAt,
        affectedOrders,
        ...(affectedOrders.length > 0 && {
          warning: `${affectedOrders.length} pedido(s) pendente(s) deixaram de ser entregáveis com esta zona.`,
        }),
      });
    } catch (err) {
      next(err);
    }
  };

  list = (_req: Request, res: Response): void => {
    res.json(
      this.zoneRepository.findAll().map((zone) => ({
        id: zone.id,
        name: zone.name,
        center: zone.center,
        radiusKm: zone.radiusKm,
      }))
    );
  };

  remove = (req: Request, res: Response): void => {
    const id = String(req.params.id);
    const removed = this.zoneRepository.remove(id);

    if (!removed) {
      res.status(404).json({ error: `Zona "${id}" não encontrada.` });
      return;
    }

    res.status(204).send();
  };

  /** Pedidos pendentes que, com as zonas atuais, não têm mais como ser entregues. */
  private findNewlyUnfulfillableOrders(): Array<{
    id: string;
    location: Order['location'];
    reason: string;
    reasonCode: UnassignmentReason;
  }> {
    const zones = this.zoneRepository.findAll();

    return this.orderRepository
      .findPending()
      .map((order) => ({ order, reason: checkFitsAlone(order, droneSpecs, zones) }))
      .filter((entry) => entry.reason !== null)
      .map(({ order, reason }) => ({
        id: order.id,
        location: order.location,
        reason: IMPACT_MESSAGES[reason as UnassignmentReason],
        reasonCode: reason as UnassignmentReason,
      }));
  }
}
