import { DroneStatus } from './types';
import { Order } from './Order';

export interface DroneSpecs {
  /** Capacidade máxima de carga, em kg */
  maxWeightKg: number;
  /** Alcance máximo por carga de bateria, em km */
  maxRangeKm: number;
  /** Consumo de bateria por km percorrido, em % (0-100). Padrão: proporcional ao alcance. */
  batteryDrainPerKm?: number;
}

const VALID_TRANSITIONS: Record<DroneStatus, DroneStatus[]> = {
  [DroneStatus.IDLE]: [DroneStatus.CHARGING, DroneStatus.IN_FLIGHT],
  [DroneStatus.CHARGING]: [DroneStatus.IDLE],
  [DroneStatus.IN_FLIGHT]: [DroneStatus.DELIVERING],
  [DroneStatus.DELIVERING]: [DroneStatus.IN_FLIGHT, DroneStatus.RETURNING],
  [DroneStatus.RETURNING]: [DroneStatus.IDLE],
};

let droneSequence = 0;

export class Drone {
  public readonly id: string;
  public readonly maxWeightKg: number;
  public readonly maxRangeKm: number;
  private readonly batteryDrainPerKm: number;

  public status: DroneStatus = DroneStatus.IDLE;
  public batteryPercent = 100;
  public totalDistanceFlownKm = 0;
  public totalDeliveries = 0;
  public assignedOrders: Order[] = [];

  constructor(specs: DroneSpecs) {
    droneSequence += 1;
    this.id = `drone-${droneSequence}`;
    this.maxWeightKg = specs.maxWeightKg;
    this.maxRangeKm = specs.maxRangeKm;
    // Se não informado, a bateria dura exatamente o alcance máximo declarado.
    this.batteryDrainPerKm = specs.batteryDrainPerKm ?? 100 / specs.maxRangeKm;
  }

  get remainingRangeKm(): number {
    return this.batteryPercent / this.batteryDrainPerKm;
  }

  get isAvailable(): boolean {
    return this.status === DroneStatus.IDLE && this.batteryPercent > 0;
  }

  canCarry(totalWeightKg: number): boolean {
    return totalWeightKg <= this.maxWeightKg;
  }

  canFly(distanceKm: number): boolean {
    return distanceKm <= this.remainingRangeKm && distanceKm <= this.maxRangeKm;
  }

  transitionTo(newStatus: DroneStatus): void {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transição inválida: ${this.status} -> ${newStatus}. Permitidas: ${allowed.join(', ')}`
      );
    }
    this.status = newStatus;
  }

  /** Consome bateria proporcional à distância percorrida. */
  flyDistance(distanceKm: number): void {
    if (!this.canFly(distanceKm)) {
      throw new Error(
        `Drone ${this.id} não tem alcance/bateria suficiente para voar ${distanceKm.toFixed(2)}km`
      );
    }
    this.batteryPercent = Math.max(0, this.batteryPercent - distanceKm * this.batteryDrainPerKm);
    this.totalDistanceFlownKm += distanceKm;
  }

  /** Recarrega totalmente a bateria e volta para o estado Idle. */
  recharge(): void {
    this.transitionTo(DroneStatus.CHARGING);
    this.batteryPercent = 100;
    this.transitionTo(DroneStatus.IDLE);
  }

  assignOrders(orders: Order[]): void {
    this.assignedOrders = orders;
    orders.forEach((order) => order.assignTo(this.id));
  }

  completeDeliveries(): void {
    this.assignedOrders.forEach((order) => order.markDelivered());
    this.totalDeliveries += this.assignedOrders.length;
    this.assignedOrders = [];
  }

  /** Fotografia do estado atual, para gravar no banco. */
  toPersistence(): PersistedDrone {
    return {
      id: this.id,
      maxWeightKg: this.maxWeightKg,
      maxRangeKm: this.maxRangeKm,
      batteryDrainPerKm: this.batteryDrainPerKm,
      status: this.status,
      batteryPercent: this.batteryPercent,
      totalDistanceFlownKm: this.totalDistanceFlownKm,
      totalDeliveries: this.totalDeliveries,
    };
  }
}

/** Estado completo de um drone, como sai e volta da persistência. */
export interface PersistedDrone {
  id: string;
  maxWeightKg: number;
  maxRangeKm: number;
  batteryDrainPerKm: number;
  status: DroneStatus;
  batteryPercent: number;
  totalDistanceFlownKm: number;
  totalDeliveries: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Reconstrói um drone vindo do banco. Como em `rehydrateOrder`, evita o
 * construtor para não consumir ids da sequência.
 *
 * `assignedOrders` não é persistido: só tem conteúdo durante a execução de uma
 * viagem, e `completeDeliveries()` o esvazia ao final. Um drone lido do banco
 * está sempre entre viagens.
 */
export function rehydrateDrone(data: PersistedDrone): Drone {
  // `batteryDrainPerKm` é privado, então o cast passa por `unknown`: aqui
  // estamos legitimamente montando a instância campo a campo, papel que
  // normalmente caberia ao construtor.
  const drone = Object.create(Drone.prototype) as unknown as Mutable<Drone> & {
    batteryDrainPerKm: number;
  };

  drone.id = data.id;
  drone.maxWeightKg = data.maxWeightKg;
  drone.maxRangeKm = data.maxRangeKm;
  drone.batteryDrainPerKm = data.batteryDrainPerKm;
  drone.status = data.status;
  drone.batteryPercent = data.batteryPercent;
  drone.totalDistanceFlownKm = data.totalDistanceFlownKm;
  drone.totalDeliveries = data.totalDeliveries;
  drone.assignedOrders = [];

  return drone as unknown as Drone;
}

/** Ver `ensureOrderSequenceAbove`: evita colisão de ids após reiniciar. */
export function ensureDroneSequenceAbove(value: number): void {
  droneSequence = Math.max(droneSequence, value);
}

export function _resetDroneSequenceForTests(): void {
  droneSequence = 0;
}
