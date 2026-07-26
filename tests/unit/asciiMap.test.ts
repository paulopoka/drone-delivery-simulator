import { renderAsciiMap, MAP_LABELS } from '../../src/utils/asciiMap';

function cells(map: string): string[] {
  return map.split('\n').map((row) => row.replace(/ /g, ''));
}

describe('renderAsciiMap', () => {
  it('desenha a base mesmo sem nenhum ponto', () => {
    const map = renderAsciiMap([]);
    expect(map).toContain('@');
  });

  it('respeita as dimensões pedidas', () => {
    const map = renderAsciiMap([{ label: 'A', location: { x: 5, y: 5 } }], {
      width: 10,
      height: 4,
    });
    const rows = map.split('\n');

    expect(rows).toHaveLength(4);
    rows.forEach((row) => expect(row.replace(/ /g, '')).toHaveLength(10));
  });

  it('desenha o ponto informado na grade', () => {
    const map = renderAsciiMap([{ label: 'A', location: { x: 5, y: 5 } }]);
    expect(map).toContain('A');
  });

  it('coloca Y maior acima de Y menor (eixo cartesiano, não índice de linha)', () => {
    const map = renderAsciiMap([
      { label: 'N', location: { x: 0, y: 10 } },
      { label: 'S', location: { x: 0, y: -10 } },
    ]);
    const rows = cells(map);
    const rowOfNorth = rows.findIndex((r) => r.includes('N'));
    const rowOfSouth = rows.findIndex((r) => r.includes('S'));

    expect(rowOfNorth).toBeLessThan(rowOfSouth);
  });

  it('posiciona X maior à direita de X menor', () => {
    const map = renderAsciiMap([
      { label: 'L', location: { x: -10, y: 0 } },
      { label: 'R', location: { x: 10, y: 0 } },
    ]);
    const row = cells(map).find((r) => r.includes('L') && r.includes('R'));

    expect(row).toBeDefined();
    expect(row!.indexOf('L')).toBeLessThan(row!.indexOf('R'));
  });

  it('lida com coordenadas negativas e fracionárias sem quebrar', () => {
    const map = renderAsciiMap([
      { label: 'A', location: { x: -2.5, y: -3.7 } },
      { label: 'B', location: { x: 1.2, y: 4.8 } },
    ]);

    expect(map).toContain('A');
    expect(map).toContain('B');
    expect(map).toContain('@');
  });

  it('não quebra quando todos os pontos estão na mesma coordenada (intervalo degenerado)', () => {
    const map = renderAsciiMap([
      { label: 'A', location: { x: 3, y: 3 } },
      { label: 'B', location: { x: 3, y: 3 } },
    ]);

    // Os dois caem na mesma célula, que vira marcador de colisão.
    expect(map).toContain('*');
    expect(map).not.toContain('NaN');
  });

  it('marca com * quando dois pontos caem na mesma célula', () => {
    const map = renderAsciiMap(
      [
        { label: 'A', location: { x: 10, y: 10 } },
        { label: 'B', location: { x: 10.01, y: 10.01 } },
      ],
      { width: 5, height: 5 }
    );

    expect(map).toContain('*');
  });

  it('nunca deixa um pedido esconder a base', () => {
    const map = renderAsciiMap([{ label: 'A', location: { x: 0, y: 0 } }]);
    expect(map).toContain('@');
  });

  it('usa um símbolo de base que nenhum rótulo de pedido pode reproduzir', () => {
    // Regressão: a base já foi 'H', que é exatamente o 8º rótulo — o 8º pedido
    // aparecia no mapa com o mesmo símbolo da base.
    const map = renderAsciiMap(
      MAP_LABELS.slice(0, 10).map((label, i) => ({
        label,
        location: { x: i + 1, y: i + 1 },
      }))
    );
    const baseSymbol = '@';

    expect(MAP_LABELS).not.toContain(baseSymbol);
    expect(map.split('\n').join('').split(baseSymbol)).toHaveLength(2); // exatamente 1 ocorrência
  });

  it('expõe 52 rótulos únicos (A-Z, a-z)', () => {
    expect(MAP_LABELS).toHaveLength(52);
    expect(new Set(MAP_LABELS).size).toBe(52);
    expect(MAP_LABELS[0]).toBe('A');
    expect(MAP_LABELS[26]).toBe('a');
  });
});
