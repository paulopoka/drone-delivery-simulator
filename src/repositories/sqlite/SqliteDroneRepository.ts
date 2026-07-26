import { DatabaseSync } from 'node:sqlite';
import { Drone, rehydrateDrone, ensureDroneSequenceAbove } from '../../domain/Drone';
import { idSequenceNumber } from '../../domain/Order';
import { DroneStatus } from '../../domain/types';
import { DroneRepository } from '../DroneRepository';

interface DroneRow {
  id: string;
  max_weight_kg: number;
  max_range_km: number;
  battery_drain_per_km: number;
  status: string;
  battery_percent: number;
  total_distance_flown_km: number;
  total_deliveries: number;
}

function toDomain(row: DroneRow): Drone {
  return rehydrateDrone({
    id: row.id,
    maxWeightKg: row.max_weight_kg,
    maxRangeKm: row.max_range_km,
    batteryDrainPerKm: row.battery_drain_per_km,
    status: row.status as DroneStatus,
    batteryPercent: row.battery_percent,
    totalDistanceFlownKm: row.total_distance_flown_km,
    totalDeliveries: row.total_deliveries,
  });
}

export class SqliteDroneRepository implements DroneRepository {
  constructor(private readonly db: DatabaseSync) {
    this.restoreIdSequence();
  }

  save(drone: Drone): Drone {
    const data = drone.toPersistence();

    this.db
      .prepare(
        `INSERT INTO drones (id, max_weight_kg, max_range_km, battery_drain_per_km,
                             status, battery_percent, total_distance_flown_km, total_deliveries)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           battery_percent = excluded.battery_percent,
           total_distance_flown_km = excluded.total_distance_flown_km,
           total_deliveries = excluded.total_deliveries`
      )
      .run(
        data.id,
        data.maxWeightKg,
        data.maxRangeKm,
        data.batteryDrainPerKm,
        data.status,
        data.batteryPercent,
        data.totalDistanceFlownKm,
        data.totalDeliveries
      );

    return drone;
  }

  findAll(): Drone[] {
    const rows = this.db.prepare('SELECT * FROM drones ORDER BY id').all() as unknown as DroneRow[];
    return rows.map(toDomain);
  }

  findById(id: string): Drone | undefined {
    const row = this.db.prepare('SELECT * FROM drones WHERE id = ?').get(id) as
      | DroneRow
      | undefined;
    return row ? toDomain(row) : undefined;
  }

  clear(): void {
    this.db.exec('DELETE FROM drones');
  }

  private restoreIdSequence(): void {
    const rows = this.db.prepare('SELECT id FROM drones').all() as unknown as Array<{ id: string }>;
    rows.forEach((row) => ensureDroneSequenceAbove(idSequenceNumber(row.id)));
  }
}
