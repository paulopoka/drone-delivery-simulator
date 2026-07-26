import { OrderRepository } from './OrderRepository';
import { DroneRepository } from './DroneRepository';
import { NoFlyZoneRepository } from './NoFlyZoneRepository';
import { InMemoryOrderRepository } from './inMemory/InMemoryOrderRepository';
import { InMemoryDroneRepository } from './inMemory/InMemoryDroneRepository';
import { InMemoryNoFlyZoneRepository } from './inMemory/InMemoryNoFlyZoneRepository';

export * from './OrderRepository';
export * from './DroneRepository';
export * from './NoFlyZoneRepository';
export * from './inMemory/InMemoryOrderRepository';
export * from './inMemory/InMemoryDroneRepository';
export * from './inMemory/InMemoryNoFlyZoneRepository';

export type StorageDriver = 'memory' | 'sqlite';

export interface Repositories {
  orderRepository: OrderRepository;
  droneRepository: DroneRepository;
  zoneRepository: NoFlyZoneRepository;
  /** Fecha a conexão, quando houver. No-op para o driver em memória. */
  close(): void;
}

export interface RepositoryOptions {
  driver?: StorageDriver;
  /** Arquivo do banco; `:memory:` cria um SQLite efêmero (útil em teste). */
  databaseFile?: string;
}

/**
 * Monta o conjunto de repositórios conforme o driver escolhido.
 *
 * O `require` do módulo SQLite é feito aqui dentro, e não no topo do arquivo,
 * de propósito: `node:sqlite` só existe a partir do Node 22.5, e um import
 * estático quebraria a aplicação inteira em versões mais antigas — mesmo para
 * quem nunca pediu SQLite. Assim, quem roda no driver padrão (memória) não
 * paga por uma dependência que não usa.
 */
export function createRepositories(options: RepositoryOptions = {}): Repositories {
  const driver = options.driver ?? 'memory';

  if (driver === 'sqlite') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabase } = require('./sqlite/database');
    const { SqliteOrderRepository } = require('./sqlite/SqliteOrderRepository');
    const { SqliteDroneRepository } = require('./sqlite/SqliteDroneRepository');
    const { SqliteNoFlyZoneRepository } = require('./sqlite/SqliteNoFlyZoneRepository');

    const db = openDatabase(options.databaseFile ?? 'drone-delivery.db');

    return {
      orderRepository: new SqliteOrderRepository(db),
      droneRepository: new SqliteDroneRepository(db),
      zoneRepository: new SqliteNoFlyZoneRepository(db),
      close: () => db.close(),
    };
  }

  return {
    orderRepository: new InMemoryOrderRepository(),
    droneRepository: new InMemoryDroneRepository(),
    zoneRepository: new InMemoryNoFlyZoneRepository(),
    close: () => undefined,
  };
}
