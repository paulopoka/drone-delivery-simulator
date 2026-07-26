import { Drone } from '../../domain/Drone';
import { DroneRepository } from '../DroneRepository';

export class InMemoryDroneRepository implements DroneRepository {
  private drones: Map<string, Drone> = new Map();

  save(drone: Drone): Drone {
    this.drones.set(drone.id, drone);
    return drone;
  }

  findAll(): Drone[] {
    return Array.from(this.drones.values());
  }

  findById(id: string): Drone | undefined {
    return this.drones.get(id);
  }

  clear(): void {
    this.drones.clear();
  }
}
