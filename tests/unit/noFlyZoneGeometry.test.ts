import {
  distancePointToSegment,
  isInsideZone,
  segmentCrossesZone,
  findBlockingZone,
  findZoneContaining,
} from '../../src/utils/geometry';
import { NoFlyZone, _resetZoneSequenceForTests } from '../../src/domain/NoFlyZone';

function zone(x: number, y: number, radiusKm: number, name = 'zona'): NoFlyZone {
  return new NoFlyZone({ center: { x, y }, radiusKm, name });
}

describe('geometria das zonas de exclusão', () => {
  beforeEach(() => {
    _resetZoneSequenceForTests();
  });

  describe('distancePointToSegment', () => {
    it('mede a perpendicular quando o pé cai dentro do segmento', () => {
      // Ponto (0,5) sobre o segmento horizontal de (-10,0) a (10,0)
      const d = distancePointToSegment({ x: 0, y: 5 }, { x: -10, y: 0 }, { x: 10, y: 0 });
      expect(d).toBeCloseTo(5, 6);
    });

    it('mede até a extremidade quando o pé da perpendicular cai fora do segmento', () => {
      // A reta infinita passaria a 0 de distância, mas o segmento termina em (10,0):
      // a distância real é até essa ponta.
      const d = distancePointToSegment({ x: 20, y: 0 }, { x: -10, y: 0 }, { x: 10, y: 0 });
      expect(d).toBeCloseTo(10, 6);
    });

    it('retorna 0 para um ponto sobre o segmento', () => {
      const d = distancePointToSegment({ x: 3, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(d).toBeCloseTo(0, 6);
    });

    it('trata segmento degenerado (início == fim) como distância até o ponto', () => {
      const d = distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(d).toBeCloseTo(5, 6);
    });
  });

  describe('isInsideZone', () => {
    it('detecta ponto no interior', () => {
      expect(isInsideZone({ x: 1, y: 0 }, zone(0, 0, 2))).toBe(true);
    });

    it('não considera invasão um ponto exatamente na borda', () => {
      expect(isInsideZone({ x: 2, y: 0 }, zone(0, 0, 2))).toBe(false);
    });

    it('detecta ponto fora', () => {
      expect(isInsideZone({ x: 5, y: 0 }, zone(0, 0, 2))).toBe(false);
    });
  });

  describe('segmentCrossesZone', () => {
    it('detecta trecho que atravessa a zona pelo meio', () => {
      const crosses = segmentCrossesZone({ x: -10, y: 0 }, { x: 10, y: 0 }, zone(0, 0, 3));
      expect(crosses).toBe(true);
    });

    it('não acusa trecho que passa longe', () => {
      const crosses = segmentCrossesZone({ x: -10, y: 20 }, { x: 10, y: 20 }, zone(0, 0, 3));
      expect(crosses).toBe(false);
    });

    it('não acusa trecho tangente à borda', () => {
      // Passa exatamente a 3 de distância de um círculo de raio 3.
      const crosses = segmentCrossesZone({ x: -10, y: 3 }, { x: 10, y: 3 }, zone(0, 0, 3));
      expect(crosses).toBe(false);
    });

    it('não acusa quando a zona está "atrás" do trecho (fora da projeção)', () => {
      // A zona fica em x=-20; o segmento vai de (0,0) a (10,0). A reta infinita
      // cruzaria a zona, mas o segmento não.
      const crosses = segmentCrossesZone({ x: 0, y: 0 }, { x: 10, y: 0 }, zone(-20, 0, 3));
      expect(crosses).toBe(false);
    });

    it('acusa quando uma das pontas está dentro da zona', () => {
      const crosses = segmentCrossesZone({ x: 0, y: 0 }, { x: 5, y: 0 }, zone(5, 0, 2));
      expect(crosses).toBe(true);
    });
  });

  describe('findBlockingZone / findZoneContaining', () => {
    it('encontra a zona que bloqueia entre várias', () => {
      const zones = [zone(0, 50, 3, 'longe'), zone(5, 0, 2, 'no-caminho')];
      const blocking = findBlockingZone({ x: 0, y: 0 }, { x: 10, y: 0 }, zones);

      expect(blocking?.name).toBe('no-caminho');
    });

    it('devolve undefined quando nada bloqueia', () => {
      expect(findBlockingZone({ x: 0, y: 0 }, { x: 1, y: 0 }, [zone(0, 50, 3)])).toBeUndefined();
    });

    it('encontra a zona que contém um ponto', () => {
      const found = findZoneContaining({ x: 5, y: 0 }, [zone(0, 0, 2), zone(5, 0, 1, 'alvo')]);
      expect(found?.name).toBe('alvo');
    });

    it('devolve undefined para lista de zonas vazia', () => {
      expect(findZoneContaining({ x: 5, y: 0 }, [])).toBeUndefined();
    });
  });
});
