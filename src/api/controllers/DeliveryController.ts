import { Request, Response, NextFunction } from 'express';
import { OrderRepository } from '../../repositories/OrderRepository';
import { DroneRepository } from '../../repositories/DroneRepository';
import { NoFlyZoneRepository } from '../../repositories/NoFlyZoneRepository';
import { AllocationService, Trip } from '../../services/AllocationService';
import { SimulationService } from '../../services/SimulationService';
import { StrategyComparisonService } from '../../services/StrategyComparisonService';
import { UnassignmentReason } from '../../services/strategies';
import { droneSpecs, droneSpeedKmH } from '../../config';

/** Mensagem legível para cada motivo de não-alocação. */
const UNASSIGNMENT_MESSAGES: Record<UnassignmentReason, string> = {
  [UnassignmentReason.TOO_HEAVY]: 'Peso excede a capacidade máxima do drone.',
  [UnassignmentReason.OUT_OF_RANGE]: 'Distância excede o alcance máximo do drone, mesmo sozinho.',
  [UnassignmentReason.INSIDE_NO_FLY_ZONE]:
    'Endereço de entrega está dentro de uma zona de exclusão aérea.',
  [UnassignmentReason.UNREACHABLE_DUE_TO_ZONES]:
    'Não há rota aérea viável: as zonas de exclusão bloqueiam todos os caminhos.',
};

export class DeliveryController {
  private readonly allocationService = new AllocationService(droneSpecs);
  private readonly simulationService = new SimulationService(droneSpeedKmH);
  private readonly comparisonService = new StrategyComparisonService(droneSpecs);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly droneRepository: DroneRepository,
    private readonly zoneRepository: NoFlyZoneRepository
  ) {}

  planAndExecuteRoutes = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const pendingOrders = this.orderRepository.findPending();

      if (pendingOrders.length === 0) {
        res.json({
          message: 'Não há pedidos pendentes para alocar.',
          trips: [],
          unassignedOrders: [],
        });
        return;
      }

      const zones = this.zoneRepository.findAll();
      const { trips, unassignedOrders } = this.allocationService.allocate(pendingOrders, zones);

      const report = this.simulationService.run(trips);

      // A gravação acontece DEPOIS da simulação, e é obrigatória: a simulação
      // muta as entidades (pedido vira entregue, drone gasta bateria e acumula
      // quilometragem), e essas mudanças precisam voltar para o repositório.
      //
      // Com persistência em memória isso "funcionava" sem gravar nada, porque
      // o repositório devolvia as próprias instâncias e mutá-las já alterava o
      // que estava guardado. Com um banco de verdade, `findPending()` devolve
      // objetos reconstruídos, e sem este passo a simulação rodava sobre cópias
      // soltas: o pedido continuava pendente e o drone, zerado.
      this.persistSimulationResult(trips);

      res.json({
        summary: report,
        efficiency: this.buildEfficiency(trips),
        noFlyZonesActive: zones.length,
        trips: trips.map((trip) => ({
          droneId: trip.drone.id,
          orders: trip.orders.map((o) => o.id),
          totalWeightKg: trip.totalWeightKg,
          distanceKm: Number(trip.distanceKm.toFixed(2)),
          hasDetour: trip.route.hasDetour,
        })),
        unassignedOrders: unassignedOrders.map(({ order, reason }) => ({
          id: order.id,
          reason: UNASSIGNMENT_MESSAGES[reason],
          reasonCode: reason,
        })),
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Compara as estratégias de alocação disponíveis usando os pedidos pendentes.
   * Não executa nada: é uma simulação a seco, que não cria drones nem altera
   * o estado dos pedidos.
   */
  compareStrategies = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const pendingOrders = this.orderRepository.findPending();
      const zones = this.zoneRepository.findAll();
      res.json(this.comparisonService.compare(pendingOrders, zones));
    } catch (err) {
      next(err);
    }
  };

  /** Grava o estado final de drones e pedidos após a execução das viagens. */
  private persistSimulationResult(trips: Trip[]): void {
    trips.forEach((trip) => {
      this.droneRepository.save(trip.drone);
      trip.orders.forEach((order) => this.orderRepository.save(order));
    });
  }

  /**
   * Quantas viagens o agrupamento economizou em relação ao pior caso possível
   * (uma viagem por pedido) — a métrica que traduz o objetivo principal do
   * desafio em número.
   */
  private buildEfficiency(trips: Trip[]): {
    tripsUsed: number;
    naiveTrips: number;
    tripsSaved: number;
    savingsPercent: number;
  } {
    const tripsUsed = trips.length;
    const naiveTrips = trips.reduce((sum, trip) => sum + trip.orders.length, 0);

    return {
      tripsUsed,
      naiveTrips,
      tripsSaved: naiveTrips - tripsUsed,
      savingsPercent:
        naiveTrips > 0 ? Number((((naiveTrips - tripsUsed) / naiveTrips) * 100).toFixed(1)) : 0,
    };
  }
}
