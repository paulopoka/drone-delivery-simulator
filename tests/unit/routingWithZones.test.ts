import { planLeg, planRoute, optimizedRouteDistance } from '../../src/utils/routing';
import { segmentCrossesZone } from '../../src/utils/geometry';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';
import { Coordinates } from '../../src/domain/types';

function zone(x: number, y: number, radiusKm: number, name = 'zona'): NoFlyZone {
  return new NoFlyZone({ center: { x, y }, radiusKm, name });
}

/** Confere que nenhum trecho do caminho invade nenhuma zona. */
function pathIsClear(path: Coordinates[], zones: NoFlyZone[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (zones.some((z) => segmentCrossesZone(path[i], path[i + 1], z))) return false;
  }
  return true;
}

describe('roteamento com zonas de exclusão', () => {
  beforeEach(() => {
    _resetZoneSequenceForTests();
  });

  describe('planLeg', () => {
    it('vai em linha reta quando nada bloqueia', () => {
      const leg = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, []);

      expect(leg).not.toBeNull();
      expect(leg!.hasDetour).toBe(false);
      expect(leg!.path).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]);
      expect(leg!.distanceKm).toBeCloseTo(10, 6);
    });

    it('desvia quando há zona no meio do caminho', () => {
      const zones = [zone(5, 0, 2)];
      const leg = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, zones);

      expect(leg).not.toBeNull();
      expect(leg!.hasDetour).toBe(true);
      expect(leg!.path).toHaveLength(3); // origem, waypoint, destino
    });

    it('o caminho com desvio realmente não invade a zona', () => {
      const zones = [zone(5, 0, 2)];
      const leg = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, zones);

      expect(pathIsClear(leg!.path, zones)).toBe(true);
    });

    it('o desvio é mais longo que a linha reta (custo do contorno)', () => {
      const zones = [zone(5, 0, 2)];
      const straight = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, [])!;
      const detoured = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, zones)!;

      expect(detoured.distanceKm).toBeGreaterThan(straight.distanceKm);
    });

    it('recusa quando o destino está dentro da zona', () => {
      const leg = planLeg({ x: 0, y: 0 }, { x: 5, y: 0 }, [zone(5, 0, 2)]);
      expect(leg).toBeNull();
    });

    it('recusa quando a origem está dentro da zona', () => {
      const leg = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, [zone(0, 0, 2)]);
      expect(leg).toBeNull();
    });

    it('recusa quando o destino está cercado por zonas (sem saída)', () => {
      // Anel de zonas em volta do destino (10,0): qualquer aproximação cruza uma.
      const target = { x: 10, y: 0 };
      const ring = Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * 2 * Math.PI;
        return zone(target.x + Math.cos(angle) * 3, target.y + Math.sin(angle) * 3, 1.6);
      });

      const leg = planLeg({ x: 0, y: 0 }, target, ring);
      expect(leg).toBeNull();
    });

    it('não desvia para dentro de uma segunda zona', () => {
      // Zona no caminho + zona logo acima, bloqueando um dos dois contornos.
      const zones = [zone(5, 0, 2), zone(5, 3.5, 2)];
      const leg = planLeg({ x: 0, y: 0 }, { x: 10, y: 0 }, zones);

      if (leg) {
        expect(pathIsClear(leg.path, zones)).toBe(true);
      }
    });
  });

  describe('planRoute', () => {
    it('sem zonas, a distância é igual ao roteamento em linha reta de sempre', () => {
      const stops = [
        { x: 3, y: 4 },
        { x: -2, y: 1 },
        { x: 5, y: -3 },
      ];
      const route = planRoute(stops, []);

      expect(route).not.toBeNull();
      expect(route!.distanceKm).toBeCloseTo(optimizedRouteDistance(stops), 6);
      expect(route!.hasDetour).toBe(false);
    });

    it('devolve rota vazia e distância 0 quando não há paradas', () => {
      const route = planRoute([], []);

      expect(route).not.toBeNull();
      expect(route!.legs).toEqual([]);
      expect(route!.distanceKm).toBe(0);
    });

    it('gera um trecho a mais que o número de paradas (o retorno à base)', () => {
      const route = planRoute([{ x: 3, y: 0 }, { x: 6, y: 0 }], []);

      expect(route!.orderedStops).toHaveLength(2);
      expect(route!.legs).toHaveLength(3);
    });

    it('o último trecho sempre volta para a base', () => {
      const route = planRoute([{ x: 3, y: 4 }], []);
      const lastLeg = route!.legs[route!.legs.length - 1];

      expect(lastLeg.to).toEqual({ x: 0, y: 0 });
    });

    it('marca hasDetour e cobra a distância extra quando contorna uma zona', () => {
      const stops = [{ x: 10, y: 0 }];
      const zones = [zone(5, 0, 2)];

      const semZona = planRoute(stops, [])!;
      const comZona = planRoute(stops, zones)!;

      expect(comZona.hasDetour).toBe(true);
      expect(comZona.distanceKm).toBeGreaterThan(semZona.distanceKm);
    });

    it('a rota inteira, incluindo desvios, fica livre das zonas', () => {
      const zones = [zone(4, 0, 1.5), zone(0, 4, 1.5)];
      const route = planRoute(
        [
          { x: 8, y: 0 },
          { x: 0, y: 8 },
        ],
        zones
      );

      expect(route).not.toBeNull();
      route!.legs.forEach((leg) => {
        expect(pathIsClear(leg.path, zones)).toBe(true);
      });
    });

    it('recusa a rota inteira se uma das paradas for inalcançável', () => {
      const route = planRoute(
        [
          { x: 3, y: 0 },
          { x: 10, y: 0 },
        ],
        [zone(10, 0, 2)] // segunda parada dentro da zona
      );

      expect(route).toBeNull();
    });
  });
});
