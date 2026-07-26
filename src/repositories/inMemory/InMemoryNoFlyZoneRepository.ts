import { NoFlyZone } from '../../domain/NoFlyZone';
import { NoFlyZoneRepository } from '../NoFlyZoneRepository';

export class InMemoryNoFlyZoneRepository implements NoFlyZoneRepository {
  private zones: Map<string, NoFlyZone> = new Map();

  save(zone: NoFlyZone): NoFlyZone {
    this.zones.set(zone.id, zone);
    return zone;
  }

  findAll(): NoFlyZone[] {
    return Array.from(this.zones.values());
  }

  findById(id: string): NoFlyZone | undefined {
    return this.zones.get(id);
  }

  remove(id: string): boolean {
    return this.zones.delete(id);
  }

  clear(): void {
    this.zones.clear();
  }
}
