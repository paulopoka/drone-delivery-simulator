import { DatabaseSync } from 'node:sqlite';

/**
 * Conexão SQLite usando o módulo **nativo do Node** (`node:sqlite`), disponível
 * a partir do Node 22.5. A escolha mantém a promessa do projeto de ter o
 * `express` como única dependência de produção — sem driver externo e sem
 * módulo nativo para compilar na máquina de quem for rodar.
 *
 * A API do `node:sqlite` é síncrona, o que é justamente o que permite trocar a
 * persistência sem transformar toda a camada HTTP em `async/await`.
 */
export function openDatabase(fileName: string): DatabaseSync {
  const db = new DatabaseSync(fileName);

  // WAL melhora leitura concorrente; foreign_keys não é usado hoje, mas ligar
  // agora evita surpresa se um relacionamento for adicionado depois.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  createSchema(db);

  return db;
}

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  TEXT PRIMARY KEY,
      x                   REAL NOT NULL,
      y                   REAL NOT NULL,
      weight_kg           REAL NOT NULL,
      priority            TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      delivered_at        TEXT,
      assigned_drone_id   TEXT
    );

    CREATE TABLE IF NOT EXISTS drones (
      id                       TEXT PRIMARY KEY,
      max_weight_kg            REAL NOT NULL,
      max_range_km             REAL NOT NULL,
      battery_drain_per_km     REAL NOT NULL,
      status                   TEXT NOT NULL,
      battery_percent          REAL NOT NULL,
      total_distance_flown_km  REAL NOT NULL,
      total_deliveries         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS no_fly_zones (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      center_x    REAL NOT NULL,
      center_y    REAL NOT NULL,
      radius_km   REAL NOT NULL,
      created_at  TEXT NOT NULL
    );

    -- findPending() é a consulta mais frequente do sistema.
    CREATE INDEX IF NOT EXISTS idx_orders_pending
      ON orders (delivered_at, assigned_drone_id);
  `);
}
