import { Request, Response } from 'express';
import { errorHandler } from '../../src/api/errorHandler';
import { ValidationError } from '../../src/api/validation';

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('errorHandler', () => {
  const req = {} as Request;
  const next = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('responde 400 com a mensagem do erro quando é um ValidationError', () => {
    const res = makeRes();
    const err = new ValidationError('peso inválido');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'peso inválido' });
  });

  it('responde 400 quando o erro é um SyntaxError de JSON malformado (body-parser)', () => {
    const res = makeRes();
    const err = new SyntaxError('Unexpected token in JSON');
    (err as unknown as { body: string }).body = '{ invalid';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Corpo da requisição inválido.' });
  });

  it('responde 500 com mensagem genérica e loga o erro para exceções inesperadas', () => {
    const res = makeRes();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('algo quebrou');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor.' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(err);

    consoleErrorSpy.mockRestore();
  });

  it('responde 500 para um SyntaxError comum que não veio do body-parser (sem propriedade "body")', () => {
    const res = makeRes();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new SyntaxError('erro de sintaxe qualquer, sem relação com o corpo da requisição');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);

    consoleErrorSpy.mockRestore();
  });
});
