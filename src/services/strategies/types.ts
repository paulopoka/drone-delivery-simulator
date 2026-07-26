import { Order } from '../../domain/Order';
import { DroneSpecs } from '../../domain/Drone';
import { NoFlyZone } from '../../domain/NoFlyZone';
import { RoutePlan } from '../../utils/routing';

/**
 * Uma viagem *planejada*: o agrupamento de pedidos e o custo dele, ainda sem
 * um drone associado. Separar "planejar" de "alocar um drone" permite comparar
 * estratégias sem efeitos colaterais (sem criar drones, sem mutar pedidos).
 */
export interface TripPlan {
  orders: Order[];
  totalWeightKg: number;
  /** Distância real da rota, já contando desvios de zonas de exclusão. */
  distanceKm: number;
  /** Rota resolvida: ordem das paradas e o caminho de cada trecho. */
  route: RoutePlan;
}

export interface AllocationPlan {
  tripPlans: TripPlan[];
  unassignedOrders: UnassignedOrder[];
}

/** Por que um pedido não pôde ser alocado. */
export enum UnassignmentReason {
  TOO_HEAVY = 'peso_excede_capacidade',
  OUT_OF_RANGE = 'fora_de_alcance',
  INSIDE_NO_FLY_ZONE = 'dentro_de_zona_de_exclusao',
  UNREACHABLE_DUE_TO_ZONES = 'sem_rota_viavel_por_zonas_de_exclusao',
}

export interface UnassignedOrder {
  order: Order;
  reason: UnassignmentReason;
}

/**
 * Contrato de uma estratégia de alocação. Todas recebem os mesmos pedidos, as
 * mesmas specs de drone e as mesmas zonas, então os resultados são diretamente
 * comparáveis entre si.
 */
export interface AllocationStrategy {
  /** Identificador curto, usado na resposta da API. */
  readonly name: string;
  /** Explicação em uma linha, exibida no comparativo. */
  readonly description: string;
  plan(orders: Order[], specs: DroneSpecs, zones?: NoFlyZone[]): AllocationPlan;
}
