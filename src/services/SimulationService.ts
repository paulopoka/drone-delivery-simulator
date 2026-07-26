import { Trip } from './AllocationService';
import { DroneStatus } from '../domain/types';

export interface DeliveryEvent {
  orderId: string;
  droneId: string;
  deliveredAt: Date;
  etaMinutesFromDispatch: number;
}

export interface DroneEfficiency {
  droneId: string;
  totalDeliveries: number;
  totalDistanceKm: number;
  /** Entregas por km voado — quanto maior, melhor o aproveitamento da viagem. */
  deliveriesPerKm: number;
}

export interface SimulationReport {
  events: DeliveryEvent[];
  totalTrips: number;
  totalDeliveries: number;
  totalDistanceKm: number;
  averageDeliveryTimeMinutes: number;
  /** Drone com melhor aproveitamento na execução; null se nenhuma viagem rodou. */
  mostEfficientDrone: DroneEfficiency | null;
  /** Quantas viagens precisaram contornar alguma zona de exclusão aérea. */
  tripsWithDetour: number;
}

/**
 * Executa a simulação de voo de cada viagem (trip), movendo o drone pela
 * máquina de estados: Idle -> (Carregando, se bateria baixa) -> Em voo ->
 * Entregando -> Em voo -> ... -> Retornando -> Idle.
 *
 * O drone voa o caminho **realmente planejado** — incluindo os desvios de zonas
 * de exclusão aérea — e não a linha reta entre paradas. Isso importa: o desvio
 * consome bateria de verdade, e uma viagem que só cabe no alcance em linha reta
 * pode não caber depois de contornar uma zona.
 *
 * A velocidade do drone é usada apenas para estimar o tempo de entrega
 * (ETA), não afeta a lógica de alocação.
 */
export class SimulationService {
  constructor(private readonly speedKmH: number = 40) {}

  run(trips: Trip[]): SimulationReport {
    const events: DeliveryEvent[] = [];
    let totalDistanceKm = 0;
    let tripsWithDetour = 0;

    for (const trip of trips) {
      const { drone, orders, route } = trip;
      if (route.orderedStops.length === 0) continue;

      // Recarga automática: se a bateria não é suficiente pra rota, recarrega antes de sair.
      if (drone.remainingRangeKm < trip.distanceKm) {
        drone.recharge();
      }

      drone.assignOrders(orders);
      drone.transitionTo(DroneStatus.IN_FLIGHT);

      let elapsedMinutes = 0;

      route.orderedStops.forEach((location, index) => {
        // legs[i] é o trecho que leva até orderedStops[i]; o último leg é o retorno.
        const leg = route.legs[index];
        drone.flyDistance(leg.distanceKm);
        elapsedMinutes += (leg.distanceKm / this.speedKmH) * 60;

        drone.transitionTo(DroneStatus.DELIVERING);
        const order = orders.find(
          (o) => o.location.x === location.x && o.location.y === location.y && !o.isDelivered
        );
        if (order) {
          order.markDelivered();
          events.push({
            orderId: order.id,
            droneId: drone.id,
            deliveredAt: new Date(),
            etaMinutesFromDispatch: Math.round(elapsedMinutes),
          });
        }

        const isLastStop = index === route.orderedStops.length - 1;
        if (!isLastStop) {
          drone.transitionTo(DroneStatus.IN_FLIGHT);
        }
      });

      // Voo de retorno à base (a partir de "Entregando", último estado do loop)
      const returnLeg = route.legs[route.legs.length - 1];
      drone.flyDistance(returnLeg.distanceKm);
      drone.transitionTo(DroneStatus.RETURNING);
      drone.transitionTo(DroneStatus.IDLE);

      drone.completeDeliveries();
      totalDistanceKm += trip.distanceKm;
      if (route.hasDetour) tripsWithDetour += 1;
    }

    const averageDeliveryTimeMinutes =
      events.length > 0
        ? events.reduce((sum, e) => sum + e.etaMinutesFromDispatch, 0) / events.length
        : 0;

    return {
      events,
      totalTrips: trips.length,
      totalDeliveries: events.length,
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      averageDeliveryTimeMinutes: Number(averageDeliveryTimeMinutes.toFixed(2)),
      mostEfficientDrone: this.findMostEfficientDrone(trips),
      tripsWithDetour,
    };
  }

  /**
   * Elege o drone com melhor razão entregas/km. Um drone que só atende um
   * cliente exatamente na base voa 0km — nesse caso usamos o número de entregas
   * como razão, em vez de deixar a divisão virar Infinity (que serializa como
   * `null` em JSON e apareceria como "sem dado" no relatório).
   */
  private findMostEfficientDrone(trips: Trip[]): DroneEfficiency | null {
    if (trips.length === 0) return null;

    const ranked = trips
      .map(({ drone }) => ({
        droneId: drone.id,
        totalDeliveries: drone.totalDeliveries,
        totalDistanceKm: Number(drone.totalDistanceFlownKm.toFixed(2)),
        deliveriesPerKm:
          drone.totalDistanceFlownKm > 0
            ? Number((drone.totalDeliveries / drone.totalDistanceFlownKm).toFixed(3))
            : drone.totalDeliveries,
      }))
      .sort((a, b) => b.deliveriesPerKm - a.deliveriesPerKm || b.totalDeliveries - a.totalDeliveries);

    return ranked[0];
  }
}
