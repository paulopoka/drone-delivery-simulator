import { Request, Response } from 'express';
import { DroneRepository } from '../../repositories/DroneRepository';

export class DroneController {
  constructor(private readonly droneRepository: DroneRepository) {}

  list = (_req: Request, res: Response): void => {
    const drones = this.droneRepository.findAll();
    res.json(
      drones.map((d) => ({
        id: d.id,
        status: d.status,
        batteryPercent: Number(d.batteryPercent.toFixed(1)),
        totalDistanceFlownKm: Number(d.totalDistanceFlownKm.toFixed(2)),
        totalDeliveries: d.totalDeliveries,
        maxWeightKg: d.maxWeightKg,
        maxRangeKm: d.maxRangeKm,
      }))
    );
  };
}
