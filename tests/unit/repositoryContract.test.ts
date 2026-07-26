import { createRepositories, Repositories, StorageDriver } from '../../src/repositories';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { Drone, _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { DroneStatus, Priority } from '../../src/domain/types';

/**
 * Os dois drivers passam exatamente pelos mesmos testes. Se um dia alguém
 * trocar a implementação em memória pela de banco (ou o contrário), é aqui que
 * uma diferença de comportamento aparece — em vez de virar bug em produção.
 *
 * O SQLite roda em `:memory:`: mesma engine e mesmo SQL do arquivo real, sem
 * deixar sujeira no disco nem tornar a suíte lenta.
 */
const DRIVERS: Array<{ name: string; driver: StorageDriver; databaseFile?: string }> = [
  { name: 'em memória', driver: 'memory' },
  { name: 'sqlite', driver: 'sqlite', databaseFile: ':memory:' },
];

describe.each(DRIVERS)('contrato de repositório — $name', ({ driver, databaseFile }) => {
  let repos: Repositories;

  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
    _resetZoneSequenceForTests();
    repos = createRepositories({ driver, databaseFile });
  });

  afterEach(() => {
    repos.close();
  });

  function makeOrder(x = 1, y = 2, weightKg = 1.5, priority = Priority.HIGH): Order {
    return new Order({ location: { x, y }, weightKg, priority });
  }

  describe('pedidos', () => {
    it('salva e recupera um pedido preservando todos os campos', () => {
      const order = makeOrder(3, -4, 2.25, Priority.MEDIUM);
      repos.orderRepository.save(order);

      const found = repos.orderRepository.findById(order.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(order.id);
      expect(found!.location).toEqual({ x: 3, y: -4 });
      expect(found!.weightKg).toBe(2.25);
      expect(found!.priority).toBe(Priority.MEDIUM);
      expect(found!.isDelivered).toBe(false);
      expect(found!.assignedDroneId).toBeNull();
    });

    it('devolve undefined para id inexistente', () => {
      expect(repos.orderRepository.findById('order-inexistente')).toBeUndefined();
    });

    it('lista todos os pedidos salvos', () => {
      repos.orderRepository.save(makeOrder());
      repos.orderRepository.save(makeOrder());

      expect(repos.orderRepository.findAll()).toHaveLength(2);
    });

    it('findPending ignora pedidos já entregues', () => {
      const delivered = makeOrder();
      delivered.markDelivered();
      repos.orderRepository.save(delivered);
      repos.orderRepository.save(makeOrder());

      expect(repos.orderRepository.findPending()).toHaveLength(1);
    });

    it('findPending ignora pedidos já alocados a um drone', () => {
      const assigned = makeOrder();
      assigned.assignTo('drone-1');
      repos.orderRepository.save(assigned);
      repos.orderRepository.save(makeOrder());

      expect(repos.orderRepository.findPending()).toHaveLength(1);
    });

    it('salvar de novo o mesmo pedido atualiza em vez de duplicar', () => {
      const order = makeOrder();
      repos.orderRepository.save(order);

      order.assignTo('drone-7');
      order.markDelivered();
      repos.orderRepository.save(order);

      expect(repos.orderRepository.findAll()).toHaveLength(1);
      const found = repos.orderRepository.findById(order.id)!;
      expect(found.assignedDroneId).toBe('drone-7');
      expect(found.isDelivered).toBe(true);
    });

    it('preserva a data de criação', () => {
      const order = makeOrder();
      repos.orderRepository.save(order);

      const found = repos.orderRepository.findById(order.id)!;
      expect(found.createdAt.toISOString()).toBe(order.createdAt.toISOString());
    });

    it('clear esvazia o repositório', () => {
      repos.orderRepository.save(makeOrder());
      repos.orderRepository.clear();

      expect(repos.orderRepository.findAll()).toEqual([]);
    });
  });

  describe('drones', () => {
    it('salva e recupera um drone preservando estado de voo', () => {
      const drone = new Drone({ maxWeightKg: 5, maxRangeKm: 10 });
      drone.flyDistance(3);
      repos.droneRepository.save(drone);

      const found = repos.droneRepository.findById(drone.id)!;

      expect(found.id).toBe(drone.id);
      expect(found.maxWeightKg).toBe(5);
      expect(found.maxRangeKm).toBe(10);
      expect(found.batteryPercent).toBeCloseTo(70, 5);
      expect(found.totalDistanceFlownKm).toBeCloseTo(3, 5);
      expect(found.status).toBe(DroneStatus.IDLE);
    });

    it('o drone recuperado mantém o comportamento de bateria', () => {
      const drone = new Drone({ maxWeightKg: 5, maxRangeKm: 10 });
      drone.flyDistance(5);
      repos.droneRepository.save(drone);

      // Se `batteryDrainPerKm` não fosse persistido, remainingRangeKm daria NaN.
      const found = repos.droneRepository.findById(drone.id)!;
      expect(found.remainingRangeKm).toBeCloseTo(5, 5);
      expect(found.canFly(4)).toBe(true);
      expect(found.canFly(6)).toBe(false);
    });

    it('salvar de novo atualiza o mesmo drone', () => {
      const drone = new Drone({ maxWeightKg: 5, maxRangeKm: 10 });
      repos.droneRepository.save(drone);
      drone.flyDistance(2);
      repos.droneRepository.save(drone);

      expect(repos.droneRepository.findAll()).toHaveLength(1);
      expect(repos.droneRepository.findById(drone.id)!.totalDistanceFlownKm).toBeCloseTo(2, 5);
    });
  });

  describe('zonas de exclusão', () => {
    it('salva e recupera uma zona', () => {
      const zone = new NoFlyZone({ center: { x: 2, y: -3 }, radiusKm: 1.5, name: 'aeroporto' });
      repos.zoneRepository.save(zone);

      const found = repos.zoneRepository.findById(zone.id)!;

      expect(found.name).toBe('aeroporto');
      expect(found.center).toEqual({ x: 2, y: -3 });
      expect(found.radiusKm).toBe(1.5);
    });

    it('remove uma zona e confirma a remoção', () => {
      const zone = new NoFlyZone({ center: { x: 2, y: 2 }, radiusKm: 1 });
      repos.zoneRepository.save(zone);

      expect(repos.zoneRepository.remove(zone.id)).toBe(true);
      expect(repos.zoneRepository.findAll()).toEqual([]);
    });

    it('remover zona inexistente devolve false', () => {
      expect(repos.zoneRepository.remove('zone-inexistente')).toBe(false);
    });

    it('usa o id como nome padrão quando nenhum é informado', () => {
      const zone = new NoFlyZone({ center: { x: 2, y: 2 }, radiusKm: 1 });
      repos.zoneRepository.save(zone);

      expect(repos.zoneRepository.findById(zone.id)!.name).toBe(zone.id);
    });
  });
});
