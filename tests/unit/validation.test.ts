import { validateCreateOrder, ValidationError } from '../../src/api/validation';

const VALID_BODY = { location: { x: 1, y: 2 }, weightKg: 1.5, priority: 'alta' };

describe('validateCreateOrder', () => {
  it('aceita um corpo válido e retorna os campos normalizados', () => {
    const result = validateCreateOrder(VALID_BODY);
    expect(result).toEqual(VALID_BODY);
  });

  it.each([null, undefined, 'string', 42])('rejeita corpo que não é um objeto (%p)', (body) => {
    expect(() => validateCreateOrder(body)).toThrow(ValidationError);
  });

  describe('location', () => {
    it('rejeita location ausente', () => {
      expect(() => validateCreateOrder({ ...VALID_BODY, location: undefined })).toThrow(
        /location/
      );
    });

    it.each([NaN, Infinity, -Infinity, 'a', null])('rejeita location.x inválido (%p)', (x) => {
      expect(() =>
        validateCreateOrder({ ...VALID_BODY, location: { x, y: 1 } })
      ).toThrow(/location/);
    });

    it.each([NaN, Infinity, -Infinity, 'a', null])('rejeita location.y inválido (%p)', (y) => {
      expect(() =>
        validateCreateOrder({ ...VALID_BODY, location: { x: 1, y } })
      ).toThrow(/location/);
    });

    it('aceita coordenadas negativas', () => {
      expect(() =>
        validateCreateOrder({ ...VALID_BODY, location: { x: -3, y: -4 } })
      ).not.toThrow();
    });
  });

  describe('weightKg', () => {
    it.each([0, -1, NaN, Infinity, -Infinity, 'a', null, undefined])(
      'rejeita weightKg inválido (%p)',
      (weightKg) => {
        expect(() => validateCreateOrder({ ...VALID_BODY, weightKg })).toThrow(/weightKg/);
      }
    );

    it('aceita peso fracionário positivo', () => {
      expect(() => validateCreateOrder({ ...VALID_BODY, weightKg: 0.1 })).not.toThrow();
    });
  });

  describe('priority', () => {
    it.each(['baixa', 'media', 'alta'])('aceita a prioridade válida "%s"', (priority) => {
      expect(() => validateCreateOrder({ ...VALID_BODY, priority })).not.toThrow();
    });

    it.each(['urgentissima', '', 1, null, undefined])('rejeita prioridade inválida (%p)', (priority) => {
      expect(() => validateCreateOrder({ ...VALID_BODY, priority })).toThrow(/priority/);
    });
  });
});
