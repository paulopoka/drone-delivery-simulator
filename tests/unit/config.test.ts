import { readPositiveNumberEnv } from '../../src/config';

describe('readPositiveNumberEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('retorna o valor padrão quando a variável não está definida', () => {
    delete process.env.TEST_VAR;
    expect(readPositiveNumberEnv('TEST_VAR', 42)).toBe(42);
  });

  it('retorna o valor sobrescrito quando a variável é um número positivo válido', () => {
    process.env.TEST_VAR = '7.5';
    expect(readPositiveNumberEnv('TEST_VAR', 42)).toBe(7.5);
  });

  it('lança erro com o nome da variável quando o valor não é numérico', () => {
    process.env.TEST_VAR = 'abc';
    expect(() => readPositiveNumberEnv('TEST_VAR', 42)).toThrow(/TEST_VAR/);
  });

  it('lança erro quando o valor é zero', () => {
    process.env.TEST_VAR = '0';
    expect(() => readPositiveNumberEnv('TEST_VAR', 42)).toThrow(/TEST_VAR/);
  });

  it('lança erro quando o valor é negativo', () => {
    process.env.TEST_VAR = '-3';
    expect(() => readPositiveNumberEnv('TEST_VAR', 42)).toThrow(/TEST_VAR/);
  });

  it('lança erro quando o valor não é finito (Infinity)', () => {
    process.env.TEST_VAR = 'Infinity';
    expect(() => readPositiveNumberEnv('TEST_VAR', 42)).toThrow(/TEST_VAR/);
  });
});

describe('config', () => {
  it('expõe droneSpecs e droneSpeedKmH válidos construídos a partir do ambiente', () => {
    const { droneSpecs, droneSpeedKmH } = require('../../src/config');

    expect(droneSpecs.maxWeightKg).toBeGreaterThan(0);
    expect(droneSpecs.maxRangeKm).toBeGreaterThan(0);
    expect(droneSpeedKmH).toBeGreaterThan(0);
  });
});
