import { DroneSpecs } from './domain/Drone';

/**
 * Lê uma variável de ambiente numérica, validando que o valor é finito e
 * positivo. Falha rápido no boot do servidor em vez de deixar um valor
 * inválido (ex: NaN vindo de "DRONE_MAX_WEIGHT_KG=abc") se propagar
 * silenciosamente pelas contas de peso/alcance/bateria — com NaN, todo
 * `valor > limite` é `false`, o que desativaria os limites em vez de
 * respeitá-los.
 */
export function readPositiveNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Variável de ambiente ${name}="${raw}" é inválida: deve ser um número positivo.`
    );
  }
  return value;
}

// Specs padrão do drone. Podem ser sobrescritas via variáveis de ambiente.
export const droneSpecs: DroneSpecs = {
  maxWeightKg: readPositiveNumberEnv('DRONE_MAX_WEIGHT_KG', 5),
  maxRangeKm: readPositiveNumberEnv('DRONE_MAX_RANGE_KM', 10),
};

export const droneSpeedKmH = readPositiveNumberEnv('DRONE_SPEED_KMH', 40);

export const port = Number(process.env.PORT ?? 3000);

const VALID_STORAGE_DRIVERS = ['memory', 'sqlite'] as const;
export type StorageDriver = (typeof VALID_STORAGE_DRIVERS)[number];

/**
 * Driver de persistência. O padrão é `memory` para que clonar e rodar funcione
 * em qualquer versão de Node suportada; `sqlite` grava em arquivo e exige
 * Node 22.5+ (ver README).
 */
export function readStorageDriver(): StorageDriver {
  const raw = (process.env.STORAGE ?? 'memory').toLowerCase();

  if (!VALID_STORAGE_DRIVERS.includes(raw as StorageDriver)) {
    throw new Error(
      `Variável de ambiente STORAGE="${process.env.STORAGE}" é inválida: use ${VALID_STORAGE_DRIVERS.join(' ou ')}.`
    );
  }
  return raw as StorageDriver;
}

export const storageDriver = readStorageDriver();

export const databaseFile = process.env.DATABASE_FILE ?? 'drone-delivery.db';
