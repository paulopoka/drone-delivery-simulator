import { Order } from '../../domain/Order';
import { DroneSpecs } from '../../domain/Drone';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { Priority } from '../../domain/types';
import { AllocationPlan, AllocationStrategy } from './types';
import { firstFitPack } from './packing';

const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.HIGH]: 0,
  [Priority.MEDIUM]: 1,
  [Priority.LOW]: 2,
};

/**
 * Estratégia padrão do sistema.
 *
 * Ordena por prioridade (alta primeiro) e, dentro da mesma prioridade, por peso
 * decrescente. A intuição do First-Fit-Decreasing clássico é que os itens mais
 * "difíceis" de encaixar devem ser tratados enquanto ainda há viagens vazias —
 * deixar os pesados por último costuma forçar viagens extras só para eles.
 */
export class FirstFitDecreasingStrategy implements AllocationStrategy {
  readonly name = 'first-fit-decreasing';
  readonly description =
    'Prioridade (alta primeiro) e, dentro da mesma prioridade, peso decrescente.';

  plan(orders: Order[], specs: DroneSpecs, zones: NoFlyZone[] = []): AllocationPlan {
    const sorted = [...orders].sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.weightKg - a.weightKg;
    });

    return firstFitPack(sorted, specs, zones);
  }
}
