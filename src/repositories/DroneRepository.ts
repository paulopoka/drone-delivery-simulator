import { Drone } from '../domain/Drone';

/** Contrato de persistência de drones. Síncrono — ver nota em `OrderRepository`. */
export interface DroneRepository {
  save(drone: Drone): Drone;
  findAll(): Drone[];
  findById(id: string): Drone | undefined;
  clear(): void;
}
