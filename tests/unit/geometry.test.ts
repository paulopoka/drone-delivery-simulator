import { distance, routeDistance, BASE_LOCATION } from '../../src/utils/geometry';

describe('geometry', () => {
  describe('distance', () => {
    it('calcula a distância euclidiana entre dois pontos', () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('retorna 0 para pontos idênticos', () => {
      expect(distance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
    });

    it('funciona com coordenadas negativas', () => {
      expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
    });
  });

  describe('routeDistance', () => {
    it('calcula ida e volta para um único ponto', () => {
      // base -> (3,4) -> base = 5 + 5 = 10
      expect(routeDistance([{ x: 3, y: 4 }])).toBe(10);
    });

    it('retorna 0 quando não há pontos', () => {
      expect(routeDistance([])).toBe(0);
    });

    it('soma corretamente uma rota com múltiplos pontos, na ordem informada', () => {
      const points = [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ];
      // base(0,0) -> (1,0) [1] -> (1,1) [1] -> base(0,0) [sqrt(2)]
      const expected = 1 + 1 + Math.sqrt(2);
      expect(routeDistance(points)).toBeCloseTo(expected, 6);
    });

    it('usa a base (0,0) como ponto de partida e chegada', () => {
      expect(BASE_LOCATION).toEqual({ x: 0, y: 0 });
    });
  });
});
