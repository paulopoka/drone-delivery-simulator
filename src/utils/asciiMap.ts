import { Coordinates } from '../domain/types';
import { NoFlyZone } from '../domain/NoFlyZone';
import { BASE_LOCATION, isInsideZone } from './geometry';

export interface MapPoint {
  /** Caractere único que representa o ponto na grade. */
  label: string;
  location: Coordinates;
}

export interface AsciiMapOptions {
  /** Colunas da grade (não é a largura em caracteres — há um espaço entre colunas). */
  width?: number;
  height?: number;
  /** Zonas de exclusão aérea, sombreadas no mapa. */
  zones?: NoFlyZone[];
}

const DEFAULT_WIDTH = 31;
const DEFAULT_HEIGHT = 15;
const EMPTY_CELL = '.';
/**
 * Símbolo da base. Precisa ser um caractere NÃO-alfabético: os rótulos dos
 * pedidos vão de A a Z, então usar uma letra aqui (ex: 'H' de "home") faria o
 * 8º pedido receber exatamente o mesmo símbolo da base no mapa.
 */
const BASE_CELL = '@';
/** Marca uma célula onde dois ou mais pontos caíram após a escala. */
const COLLISION_CELL = '*';
/** Sombreado de área proibida. */
const ZONE_CELL = '#';

/** Rótulos disponíveis para os pontos, em ordem: A-Z, depois a-z. */
export const MAP_LABELS = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)),
];

/**
 * Projeta um valor de um intervalo do mundo para um índice de célula da grade.
 * Se o intervalo for degenerado (todos os pontos na mesma coordenada), devolve
 * o centro em vez de dividir por zero.
 */
function project(value: number, min: number, max: number, cells: number): number {
  if (max - min === 0) return Math.floor((cells - 1) / 2);
  const ratio = (value - min) / (max - min);
  return Math.min(cells - 1, Math.max(0, Math.round(ratio * (cells - 1))));
}

/** Inverso de `project`: da célula da grade de volta para a coordenada do mundo. */
function unproject(cell: number, min: number, max: number, cells: number): number {
  if (cells <= 1) return (min + max) / 2;
  return min + (cell / (cells - 1)) * (max - min);
}

/**
 * Desenha os pontos em uma grade ASCII, sempre incluindo a base (`H`) em 0,0.
 *
 * A grade é *escalada* para caber no tamanho pedido — ou seja, não há relação
 * 1:1 entre unidade da malha e caractere. Isso mantém o mapa legível tanto para
 * entregas a 2km quanto a 200km, ao custo de dois pontos muito próximos poderem
 * cair na mesma célula (marcada com `*`).
 *
 * O eixo Y é invertido na renderização: Y maior aparece mais acima, como num
 * plano cartesiano, e não como índice de linha.
 */
export function renderAsciiMap(points: MapPoint[], options: AsciiMapOptions = {}): string {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const zones = options.zones ?? [];

  // Os limites incluem as bordas das zonas, para que uma área proibida não
  // fique parcialmente fora do enquadramento do mapa.
  const xs = [
    BASE_LOCATION.x,
    ...points.map((p) => p.location.x),
    ...zones.flatMap((z) => [z.center.x - z.radiusKm, z.center.x + z.radiusKm]),
  ];
  const ys = [
    BASE_LOCATION.y,
    ...points.map((p) => p.location.y),
    ...zones.flatMap((z) => [z.center.y - z.radiusKm, z.center.y + z.radiusKm]),
  ];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => EMPTY_CELL)
  );

  // As zonas são pintadas primeiro, como plano de fundo: qualquer pedido ou a
  // base desenhados depois têm prioridade visual sobre o sombreado.
  if (zones.length > 0) {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const worldX = unproject(col, minX, maxX, width);
        // A linha cresce para baixo, então desfazemos a inversão do eixo Y.
        const worldY = maxY - unproject(row, 0, maxY - minY, height);
        const cellPoint = { x: worldX, y: worldY };

        if (zones.some((zone) => isInsideZone(cellPoint, zone))) {
          grid[row][col] = ZONE_CELL;
        }
      }
    }
  }

  const place = (location: Coordinates, cell: string): void => {
    const col = project(location.x, minX, maxX, width);
    // maxY - y (em vez de y - minY) para que Y cresça para cima na tela.
    const row = project(maxY - location.y, 0, maxY - minY, height);

    // Só é colisão se a célula já tiver outro *ponto*. O sombreado de zona é
    // plano de fundo: um pedido desenhado sobre ele deve mostrar seu rótulo,
    // não virar marcador de colisão.
    const current = grid[row][col];
    const occupiedByPoint = current !== EMPTY_CELL && current !== ZONE_CELL;
    grid[row][col] = occupiedByPoint ? COLLISION_CELL : cell;
  };

  points.forEach((point) => place(point.location, point.label));

  // A base é desenhada por último para nunca ser escondida por um pedido.
  const baseCol = project(BASE_LOCATION.x, minX, maxX, width);
  const baseRow = project(maxY - BASE_LOCATION.y, 0, maxY - minY, height);
  grid[baseRow][baseCol] = BASE_CELL;

  return grid.map((row) => row.join(' ')).join('\n');
}
