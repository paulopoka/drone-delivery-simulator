import { Coordinates } from './types';

let zoneSequence = 0;

export interface CreateNoFlyZoneInput {
  center: Coordinates;
  radiusKm: number;
  name?: string;
}

/**
 * Zona de exclusão aérea: uma área circular que os drones não podem atravessar
 * (aeroporto, hospital com heliponto, área militar).
 *
 * Modelada como círculo, e não polígono, de propósito: a checagem de
 * interseção com um trecho de rota vira uma única conta de distância
 * ponto-segmento, sem perder o essencial do comportamento. Polígonos
 * arbitrários exigiriam varredura de arestas e tratamento de casos
 * degenerados, com pouco ganho para o problema em questão.
 */
export class NoFlyZone {
  public readonly id: string;
  public readonly center: Coordinates;
  public readonly radiusKm: number;
  public readonly name: string;
  public readonly createdAt: Date;

  constructor(input: CreateNoFlyZoneInput) {
    zoneSequence += 1;
    this.id = `zone-${zoneSequence}`;
    this.center = input.center;
    this.radiusKm = input.radiusKm;
    this.name = input.name ?? this.id;
    this.createdAt = new Date();
  }

  /** Fotografia do estado atual, para gravar no banco. */
  toPersistence(): PersistedNoFlyZone {
    return {
      id: this.id,
      name: this.name,
      center: this.center,
      radiusKm: this.radiusKm,
      createdAt: this.createdAt,
    };
  }
}

/** Estado completo de uma zona, como sai e volta da persistência. */
export interface PersistedNoFlyZone {
  id: string;
  name: string;
  center: Coordinates;
  radiusKm: number;
  createdAt: Date;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Reconstrói uma zona vinda do banco, sem consumir ids da sequência. */
export function rehydrateNoFlyZone(data: PersistedNoFlyZone): NoFlyZone {
  const zone = Object.create(NoFlyZone.prototype) as Mutable<NoFlyZone>;

  zone.id = data.id;
  zone.name = data.name;
  zone.center = data.center;
  zone.radiusKm = data.radiusKm;
  zone.createdAt = data.createdAt;

  return zone as NoFlyZone;
}

/** Ver `ensureOrderSequenceAbove`: evita colisão de ids após reiniciar. */
export function ensureZoneSequenceAbove(value: number): void {
  zoneSequence = Math.max(zoneSequence, value);
}

export function _resetZoneSequenceForTests(): void {
  zoneSequence = 0;
}
