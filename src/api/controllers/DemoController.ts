import { Request, Response, NextFunction } from 'express';
import { OrderRepository } from '../../repositories/OrderRepository';
import { Order } from '../../domain/Order';
import { Priority } from '../../domain/types';
import { ValidationError } from '../validation';
import { droneSpecs } from '../../config';

const DEFAULT_QUANTITY = 15;
const MAX_QUANTITY = 100;

/**
 * Fração do raio máximo alcançável usada ao sortear posições. O alcance cobre
 * ida e volta, então o raio útil já é metade; a margem extra evita gerar
 * pedidos exatamente na fronteira do alcance.
 */
const RADIUS_SAFETY = 0.9;

/**
 * Fração da capacidade do drone usada como peso máximo de um pacote sorteado.
 * Manter os pacotes abaixo da capacidade total é o que torna o agrupamento
 * possível — com pacotes no limite, toda viagem levaria um pedido só e a demo
 * não mostraria o algoritmo trabalhando.
 */
const MAX_WEIGHT_FRACTION = 0.45;

const PRIORITIES = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export class DemoController {
  constructor(private readonly orderRepository: OrderRepository) {}

  /**
   * Popula o sistema com um cenário de exemplo, para conseguir ver a simulação
   * funcionando sem precisar criar pedidos um a um.
   */
  seed = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const quantity = this.parseQuantity(req.body);
      const maxRadius = (droneSpecs.maxRangeKm / 2) * RADIUS_SAFETY;
      const maxWeight = droneSpecs.maxWeightKg * MAX_WEIGHT_FRACTION;

      const created: Order[] = [];
      for (let i = 0; i < quantity; i++) {
        // Sorteio em coordenadas polares: garante que todo ponto caia dentro do
        // alcance do drone, o que sortear x e y de forma independente não faria.
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * maxRadius;

        const order = new Order({
          location: {
            x: roundTo(Math.cos(angle) * radius, 1),
            y: roundTo(Math.sin(angle) * radius, 1),
          },
          weightKg: Math.max(0.1, roundTo(Math.random() * maxWeight, 1)),
          priority: PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)],
        });

        this.orderRepository.save(order);
        created.push(order);
      }

      res.status(201).json({
        message: `${created.length} pedidos de exemplo criados.`,
        orders: created.map((o) => ({
          id: o.id,
          location: o.location,
          weightKg: o.weightKg,
          priority: o.priority,
        })),
      });
    } catch (err) {
      next(err);
    }
  };

  private parseQuantity(body: unknown): number {
    const raw = (body as Record<string, unknown> | null | undefined)?.quantidade;
    if (raw === undefined) return DEFAULT_QUANTITY;

    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > MAX_QUANTITY) {
      throw new ValidationError(
        `Campo "quantidade" deve ser um número inteiro entre 1 e ${MAX_QUANTITY}.`
      );
    }
    return raw;
  }
}
