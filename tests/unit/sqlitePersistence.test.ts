import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRepositories, Repositories } from '../../src/repositories';
import { Order, _resetOrderSequenceForTests } from '../../src/domain/Order';
import { Drone, _resetDroneSequenceForTests } from '../../src/domain/Drone';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { Priority } from '../../src/domain/types';

/**
 * Testes que só fazem sentido com persistência de verdade: aqui o banco é um
 * arquivo real em diretório temporário, e "reiniciar o servidor" é simulado
 * fechando a conexão e abrindo outra sobre o mesmo arquivo.
 */
describe('persistência em SQLite (arquivo real)', () => {
  let directory: string;
  let databaseFile: string;

  beforeEach(() => {
    _resetOrderSequenceForTests();
    _resetDroneSequenceForTests();
    _resetZoneSequenceForTests();

    directory = mkdtempSync(join(tmpdir(), 'drone-db-'));
    databaseFile = join(directory, 'test.db');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function open(): Repositories {
    return createRepositories({ driver: 'sqlite', databaseFile });
  }

  /** Simula um restart: fecha a conexão atual e abre outra no mesmo arquivo. */
  function restart(repos: Repositories): Repositories {
    repos.close();
    return open();
  }

  it('cria o arquivo do banco', () => {
    const repos = open();
    expect(existsSync(databaseFile)).toBe(true);
    repos.close();
  });

  it('pedidos sobrevivem ao restart', () => {
    let repos = open();
    const order = new Order({
      location: { x: 3, y: 4 },
      weightKg: 2,
      priority: Priority.HIGH,
    });
    repos.orderRepository.save(order);

    repos = restart(repos);

    const found = repos.orderRepository.findById(order.id);
    expect(found).toBeDefined();
    expect(found!.location).toEqual({ x: 3, y: 4 });
    expect(found!.weightKg).toBe(2);
    expect(found!.priority).toBe(Priority.HIGH);

    repos.close();
  });

  it('o estado de entrega sobrevive ao restart', () => {
    let repos = open();
    const order = new Order({ location: { x: 1, y: 1 }, weightKg: 1, priority: Priority.LOW });
    order.assignTo('drone-3');
    order.markDelivered();
    repos.orderRepository.save(order);

    repos = restart(repos);

    const found = repos.orderRepository.findById(order.id)!;
    expect(found.isDelivered).toBe(true);
    expect(found.assignedDroneId).toBe('drone-3');
    expect(repos.orderRepository.findPending()).toEqual([]);

    repos.close();
  });

  it('drones e zonas sobrevivem ao restart', () => {
    let repos = open();
    const drone = new Drone({ maxWeightKg: 5, maxRangeKm: 10 });
    drone.flyDistance(4);
    repos.droneRepository.save(drone);
    repos.zoneRepository.save(
      new NoFlyZone({ center: { x: 2, y: 2 }, radiusKm: 1.5, name: 'aeroporto' })
    );

    repos = restart(repos);

    expect(repos.droneRepository.findById(drone.id)!.totalDistanceFlownKm).toBeCloseTo(4, 5);
    expect(repos.zoneRepository.findAll()[0].name).toBe('aeroporto');

    repos.close();
  });

  /**
   * O caso que quebraria em produção sem cuidado: o contador de ids vive em
   * memória. Reiniciar com o banco populado zeraria o contador e o próximo
   * pedido nasceria como `order-1`, colidindo com um id já gravado.
   */
  it('não reaproveita ids já gravados depois de reiniciar', () => {
    let repos = open();
    const first = new Order({ location: { x: 1, y: 1 }, weightKg: 1, priority: Priority.LOW });
    const second = new Order({ location: { x: 2, y: 2 }, weightKg: 1, priority: Priority.LOW });
    repos.orderRepository.save(first);
    repos.orderRepository.save(second);
    expect(second.id).toBe('order-2');

    // Reinício "de verdade": o contador em memória volta a zero.
    repos.close();
    _resetOrderSequenceForTests();
    repos = open();

    const afterRestart = new Order({
      location: { x: 3, y: 3 },
      weightKg: 1,
      priority: Priority.LOW,
    });
    repos.orderRepository.save(afterRestart);

    expect(afterRestart.id).not.toBe(first.id);
    expect(afterRestart.id).not.toBe(second.id);
    expect(repos.orderRepository.findAll()).toHaveLength(3);

    repos.close();
  });

  it('o mesmo vale para ids de drones e zonas', () => {
    let repos = open();
    repos.droneRepository.save(new Drone({ maxWeightKg: 5, maxRangeKm: 10 }));
    repos.zoneRepository.save(new NoFlyZone({ center: { x: 5, y: 5 }, radiusKm: 1 }));

    repos.close();
    _resetDroneSequenceForTests();
    _resetZoneSequenceForTests();
    repos = open();

    repos.droneRepository.save(new Drone({ maxWeightKg: 5, maxRangeKm: 10 }));
    repos.zoneRepository.save(new NoFlyZone({ center: { x: 6, y: 6 }, radiusKm: 1 }));

    expect(repos.droneRepository.findAll()).toHaveLength(2);
    expect(repos.zoneRepository.findAll()).toHaveLength(2);

    repos.close();
  });

  it('bancos diferentes não enxergam os dados um do outro', () => {
    const first = open();
    first.orderRepository.save(
      new Order({ location: { x: 1, y: 1 }, weightKg: 1, priority: Priority.LOW })
    );
    first.close();

    const other = createRepositories({
      driver: 'sqlite',
      databaseFile: join(directory, 'outro.db'),
    });

    expect(other.orderRepository.findAll()).toEqual([]);
    other.close();
  });
});
