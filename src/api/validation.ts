import { Priority } from '../domain/types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface CreateOrderRequestBody {
  location: { x: number; y: number };
  weightKg: number;
  priority: string;
}

const VALID_PRIORITIES = Object.values(Priority);

export function validateCreateOrder(body: unknown): CreateOrderRequestBody {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Corpo da requisição inválido.');
  }

  const { location, weightKg, priority } = body as Record<string, unknown>;

  if (
    typeof location !== 'object' ||
    location === null ||
    !Number.isFinite((location as any).x) ||
    !Number.isFinite((location as any).y)
  ) {
    throw new ValidationError('Campo "location" deve conter { x: number, y: number }.');
  }

  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    throw new ValidationError('Campo "weightKg" deve ser um número positivo.');
  }

  if (typeof priority !== 'string' || !VALID_PRIORITIES.includes(priority as Priority)) {
    throw new ValidationError(
      `Campo "priority" deve ser um dos seguintes valores: ${VALID_PRIORITIES.join(', ')}.`
    );
  }

  return {
    location: location as { x: number; y: number },
    weightKg,
    priority,
  };
}

export interface CreateNoFlyZoneRequestBody {
  center: { x: number; y: number };
  radiusKm: number;
  name?: string;
}

export function validateCreateNoFlyZone(body: unknown): CreateNoFlyZoneRequestBody {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Corpo da requisição inválido.');
  }

  const { center, radiusKm, name } = body as Record<string, unknown>;

  if (
    typeof center !== 'object' ||
    center === null ||
    !Number.isFinite((center as any).x) ||
    !Number.isFinite((center as any).y)
  ) {
    throw new ValidationError('Campo "center" deve conter { x: number, y: number }.');
  }

  if (typeof radiusKm !== 'number' || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new ValidationError('Campo "radiusKm" deve ser um número positivo.');
  }

  if (name !== undefined && typeof name !== 'string') {
    throw new ValidationError('Campo "name", quando informado, deve ser uma string.');
  }

  return {
    center: center as { x: number; y: number },
    radiusKm,
    name: name as string | undefined,
  };
}
