import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { Priority } from '../../src/domain/types';

describe('Order', () => {
  beforeEach(() => {
    _resetOrderSequenceForTests();
  });

  it('cria um pedido com os dados informados', () => {
    const order = new Order({
      location: { x: 1, y: 2 },
      weightKg: 1.2,
      priority: Priority.HIGH,
    });

    expect(order.location).toEqual({ x: 1, y: 2 });
    expect(order.weightKg).toBe(1.2);
    expect(order.priority).toBe(Priority.HIGH);
    expect(order.isDelivered).toBe(false);
    expect(order.assignedDroneId).toBeNull();
  });

  it('gera ids únicos para pedidos diferentes', () => {
    const a = new Order({ location: { x: 0, y: 0 }, weightKg: 1, priority: Priority.LOW });
    const b = new Order({ location: { x: 0, y: 0 }, weightKg: 1, priority: Priority.LOW });
    expect(a.id).not.toBe(b.id);
  });

  it('marca como entregue e define deliveredAt', () => {
    const order = new Order({ location: { x: 0, y: 0 }, weightKg: 1, priority: Priority.LOW });
    expect(order.isDelivered).toBe(false);
    order.markDelivered();
    expect(order.isDelivered).toBe(true);
    expect(order.deliveredAt).toBeInstanceOf(Date);
  });

  it('associa o pedido a um drone', () => {
    const order = new Order({ location: { x: 0, y: 0 }, weightKg: 1, priority: Priority.LOW });
    order.assignTo('drone-42');
    expect(order.assignedDroneId).toBe('drone-42');
  });
});
