import { Order } from '../../domain/Order';
import { DroneSpecs } from '../../domain/Drone';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { BASE_LOCATION, distance } from '../../utils/geometry';
import { AllocationPlan, AllocationStrategy } from './types';
import { firstFitPack } from './packing';

/**
 * Estratégia de comparação: atende primeiro quem está mais perto da base,
 * ignorando peso e prioridade.
 *
 * É uma heurística geograficamente intuitiva ("resolve o que está por perto"),
 * mas costuma perder da FFD em número de viagens: sem olhar o peso, ela enche
 * as primeiras viagens com pacotes leves e deixa os pesados sobrando no fim.
 * Serve justamente para tornar esse efeito visível no comparativo.
 */
export class NearestFirstStrategy implements AllocationStrategy {
  readonly name = 'nearest-first';
  readonly description = 'Pedidos mais próximos da base primeiro, ignorando peso e prioridade.';

  plan(orders: Order[], specs: DroneSpecs, zones: NoFlyZone[] = []): AllocationPlan {
    const sorted = [...orders].sort(
      (a, b) => distance(BASE_LOCATION, a.location) - distance(BASE_LOCATION, b.location)
    );

    return firstFitPack(sorted, specs, zones);
  }
}
