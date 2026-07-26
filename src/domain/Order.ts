import { Coordinates, Priority } from './types';

let orderSequence = 0;

export interface CreateOrderInput {
  location: Coordinates;
  weightKg: number;
  priority: Priority;
}

/** Estado completo de um pedido, como sai e volta da persistência. */
export interface PersistedOrder {
  id: string;
  location: Coordinates;
  weightKg: number;
  priority: Priority;
  createdAt: Date;
  deliveredAt: Date | null;
  assignedDroneId: string | null;
}

export class Order {
  public readonly id: string;
  public readonly location: Coordinates;
  public readonly weightKg: number;
  public readonly priority: Priority;
  public readonly createdAt: Date;
  public deliveredAt: Date | null = null;
  public assignedDroneId: string | null = null;

  constructor(input: CreateOrderInput) {
    orderSequence += 1;
    this.id = `order-${orderSequence}`;
    this.location = input.location;
    this.weightKg = input.weightKg;
    this.priority = input.priority;
    this.createdAt = new Date();
  }

  markDelivered(): void {
    this.deliveredAt = new Date();
  }

  assignTo(droneId: string): void {
    this.assignedDroneId = droneId;
  }

  get isDelivered(): boolean {
    return this.deliveredAt !== null;
  }

  /** Fotografia do estado atual, para gravar no banco. */
  toPersistence(): PersistedOrder {
    return {
      id: this.id,
      location: this.location,
      weightKg: this.weightKg,
      priority: this.priority,
      createdAt: this.createdAt,
      deliveredAt: this.deliveredAt,
      assignedDroneId: this.assignedDroneId,
    };
  }
}

/**
 * Reconstrói um pedido que já existe, vindo do banco.
 *
 * Usa `Object.create` em vez do construtor de propósito: o construtor gera um
 * id novo a partir da sequência, e reidratar 50 pedidos do banco gastaria 50
 * ids à toa — além de sobrescrever o id verdadeiro logo em seguida.
 */
export function rehydrateOrder(data: PersistedOrder): Order {
  const order = Object.create(Order.prototype) as Mutable<Order>;

  order.id = data.id;
  order.location = data.location;
  order.weightKg = data.weightKg;
  order.priority = data.priority;
  order.createdAt = data.createdAt;
  order.deliveredAt = data.deliveredAt;
  order.assignedDroneId = data.assignedDroneId;

  return order as Order;
}

/**
 * Garante que os próximos ids gerados fiquem acima dos que já estão no banco.
 *
 * Sem isto, reiniciar o servidor com um banco populado zeraria o contador e o
 * próximo pedido nasceria como `order-1`, colidindo com um id já persistido.
 */
export function ensureOrderSequenceAbove(value: number): void {
  orderSequence = Math.max(orderSequence, value);
}

/** Extrai o número de um id no formato `prefixo-N`; 0 se não casar. */
export function idSequenceNumber(id: string): number {
  const match = /-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

/** Remove os `readonly` para permitir a montagem campo a campo na reidratação. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Exposto apenas para os testes poderem resetar o contador entre execuções.
export function _resetOrderSequenceForTests(): void {
  orderSequence = 0;
}
