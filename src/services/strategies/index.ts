import { AllocationStrategy } from './types';
import { FirstFitDecreasingStrategy } from './FirstFitDecreasingStrategy';
import { NearestFirstStrategy } from './NearestFirstStrategy';
import { OneTripPerOrderStrategy } from './OneTripPerOrderStrategy';

export * from './types';
export * from './packing';
export { UnassignmentReason } from './types';
export { FirstFitDecreasingStrategy } from './FirstFitDecreasingStrategy';
export { NearestFirstStrategy } from './NearestFirstStrategy';
export { OneTripPerOrderStrategy } from './OneTripPerOrderStrategy';

/** Estratégia usada em produção pelo AllocationService. */
export const DEFAULT_STRATEGY: AllocationStrategy = new FirstFitDecreasingStrategy();

/** Todas as estratégias conhecidas, na ordem em que aparecem no comparativo. */
export const ALL_STRATEGIES: AllocationStrategy[] = [
  new OneTripPerOrderStrategy(),
  new NearestFirstStrategy(),
  new FirstFitDecreasingStrategy(),
];
