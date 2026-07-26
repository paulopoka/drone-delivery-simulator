import { DatabaseSync } from 'node:sqlite';
import {
  NoFlyZone,
  rehydrateNoFlyZone,
  ensureZoneSequenceAbove,
} from '../../domain/NoFlyZone';
import { idSequenceNumber } from '../../domain/Order';
import { NoFlyZoneRepository } from '../NoFlyZoneRepository';

interface ZoneRow {
  id: string;
  name: string;
  center_x: number;
  center_y: number;
  radius_km: number;
  created_at: string;
}

function toDomain(row: ZoneRow): NoFlyZone {
  return rehydrateNoFlyZone({
    id: row.id,
    name: row.name,
    center: { x: row.center_x, y: row.center_y },
    radiusKm: row.radius_km,
    createdAt: new Date(row.created_at),
  });
}

export class SqliteNoFlyZoneRepository implements NoFlyZoneRepository {
  constructor(private readonly db: DatabaseSync) {
    this.restoreIdSequence();
  }

  save(zone: NoFlyZone): NoFlyZone {
    const data = zone.toPersistence();

    this.db
      .prepare(
        `INSERT INTO no_fly_zones (id, name, center_x, center_y, radius_km, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           center_x = excluded.center_x,
           center_y = excluded.center_y,
           radius_km = excluded.radius_km`
      )
      .run(
        data.id,
        data.name,
        data.center.x,
        data.center.y,
        data.radiusKm,
        data.createdAt.toISOString()
      );

    return zone;
  }

  findAll(): NoFlyZone[] {
    const rows = this.db
      .prepare('SELECT * FROM no_fly_zones ORDER BY id')
      .all() as unknown as ZoneRow[];
    return rows.map(toDomain);
  }

  findById(id: string): NoFlyZone | undefined {
    const row = this.db.prepare('SELECT * FROM no_fly_zones WHERE id = ?').get(id) as
      | ZoneRow
      | undefined;
    return row ? toDomain(row) : undefined;
  }

  remove(id: string): boolean {
    const result = this.db.prepare('DELETE FROM no_fly_zones WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  clear(): void {
    this.db.exec('DELETE FROM no_fly_zones');
  }

  private restoreIdSequence(): void {
    const rows = this.db.prepare('SELECT id FROM no_fly_zones').all() as unknown as Array<{
      id: string;
    }>;
    rows.forEach((row) => ensureZoneSequenceAbove(idSequenceNumber(row.id)));
  }
}
