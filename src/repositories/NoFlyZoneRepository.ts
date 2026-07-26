import { NoFlyZone } from '../domain/NoFlyZone';

/** Contrato de persistência de zonas de exclusão. Síncrono — ver nota em `OrderRepository`. */
export interface NoFlyZoneRepository {
  save(zone: NoFlyZone): NoFlyZone;
  findAll(): NoFlyZone[];
  findById(id: string): NoFlyZone | undefined;
  /** Retorna `false` se não havia zona com esse id. */
  remove(id: string): boolean;
  clear(): void;
}
