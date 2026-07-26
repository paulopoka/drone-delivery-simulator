export enum Priority {
  LOW = 'baixa',
  MEDIUM = 'media',
  HIGH = 'alta',
}

export enum DroneStatus {
  IDLE = 'idle',
  CHARGING = 'carregando',
  IN_FLIGHT = 'em_voo',
  DELIVERING = 'entregando',
  RETURNING = 'retornando',
}

export interface Coordinates {
  x: number;
  y: number;
}
