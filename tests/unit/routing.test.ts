import { nearestNeighborOrder, optimizedRouteDistance } from '../../src/utils/routing';

describe('routing', () => {
  describe('nearestNeighborOrder', () => {
    it('retorna array vazio para entrada vazia', () => {
      expect(nearestNeighborOrder([])).toEqual([]);
    });

    it('retorna o único ponto para entrada de tamanho 1', () => {
      const points = [{ x: 5, y: 5 }];
      expect(nearestNeighborOrder(points)).toEqual(points);
    });

    it('ordena pontos do mais próximo ao mais distante da base (caso simples colinear)', () => {
      const points = [
        { x: 10, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 },
      ];
      const result = nearestNeighborOrder(points);
      expect(result).toEqual([
        { x: 2, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]);
    });

    it('não perde nem duplica pontos', () => {
      const points = [
        { x: 1, y: 1 },
        { x: -3, y: 2 },
        { x: 0, y: -5 },
        { x: 7, y: 7 },
      ];
      const result = nearestNeighborOrder(points);
      expect(result).toHaveLength(points.length);
      points.forEach((p) => {
        expect(result).toContainEqual(p);
      });
    });
  });

  describe('optimizedRouteDistance', () => {
    it('é sempre menor ou igual à distância de uma ordem arbitrária (pior caso)', () => {
      const points = [
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 5, y: 5 },
      ];
      const optimized = optimizedRouteDistance(points);
      // Rota "ingênua" na ordem de entrada original, sem otimização
      const naive =
        Math.hypot(10, 0) +
        Math.hypot(10, -10) +
        Math.hypot(-5, 5) +
        Math.hypot(-5, -5);
      expect(optimized).toBeLessThanOrEqual(naive + 1e-9);
    });
  });
});
