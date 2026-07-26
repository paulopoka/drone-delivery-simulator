import { Order } from '../../domain/Order';
import { OrderRepository } from '../OrderRepository';

export class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  save(order: Order): Order {
    this.orders.set(order.id, order);
    return order;
  }

  findAll(): Order[] {
    return Array.from(this.orders.values());
  }

  findPending(): Order[] {
    return this.findAll().filter((o) => !o.isDelivered && !o.assignedDroneId);
  }

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  clear(): void {
    this.orders.clear();
  }
}
