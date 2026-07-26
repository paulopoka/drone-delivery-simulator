import { DatabaseSync } from 'node:sqlite';
import {
  Order,
  PersistedOrder,
  rehydrateOrder,
  ensureOrderSequenceAbove,
  idSequenceNumber,
} from '../../domain/Order';
import { Priority } from '../../domain/types';
import { OrderRepository } from '../OrderRepository';

interface OrderRow {
  id: string;
  x: number;
  y: number;
  weight_kg: number;
  priority: string;
  created_at: string;
  delivered_at: string | null;
  assigned_drone_id: string | null;
}

function toDomain(row: OrderRow): Order {
  const data: PersistedOrder = {
    id: row.id,
    location: { x: row.x, y: row.y },
    weightKg: row.weight_kg,
    priority: row.priority as Priority,
    createdAt: new Date(row.created_at),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
    assignedDroneId: row.assigned_drone_id,
  };
  return rehydrateOrder(data);
}

export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly db: DatabaseSync) {
    this.restoreIdSequence();
  }

  save(order: Order): Order {
    const data = order.toPersistence();

    // UPSERT: `save` é usado tanto para criar quanto para atualizar um pedido
    // já existente (ex: depois de ser entregue).
    this.db
      .prepare(
        `INSERT INTO orders (id, x, y, weight_kg, priority, created_at, delivered_at, assigned_drone_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           delivered_at = excluded.delivered_at,
           assigned_drone_id = excluded.assigned_drone_id`
      )
      .run(
        data.id,
        data.location.x,
        data.location.y,
        data.weightKg,
        data.priority,
        data.createdAt.toISOString(),
        data.deliveredAt ? data.deliveredAt.toISOString() : null,
        data.assignedDroneId
      );

    return order;
  }

  findAll(): Order[] {
    const rows = this.db.prepare('SELECT * FROM orders ORDER BY id').all() as unknown as OrderRow[];
    return rows.map(toDomain);
  }

  findPending(): Order[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM orders WHERE delivered_at IS NULL AND assigned_drone_id IS NULL ORDER BY id'
      )
      .all() as unknown as OrderRow[];
    return rows.map(toDomain);
  }

  findById(id: string): Order | undefined {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
      | OrderRow
      | undefined;
    return row ? toDomain(row) : undefined;
  }

  clear(): void {
    this.db.exec('DELETE FROM orders');
  }

  /**
   * Ao subir com um banco já populado, alinha o contador de ids em memória com
   * o maior id gravado — senão o próximo pedido nasceria como `order-1` e
   * colidiria com um registro existente.
   */
  private restoreIdSequence(): void {
    const rows = this.db.prepare('SELECT id FROM orders').all() as unknown as Array<{ id: string }>;
    rows.forEach((row) => ensureOrderSequenceAbove(idSequenceNumber(row.id)));
  }
}
