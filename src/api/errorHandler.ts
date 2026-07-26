import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './validation';

// Assinatura de 4 parâmetros é o que o Express usa para reconhecer um
// error-handling middleware — `_next` precisa existir mesmo sem uso.
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // JSON malformado no corpo da requisição: o body-parser do Express lança
  // esse erro antes mesmo de chegar nas nossas validações. Sem esse check,
  // um corpo mal formado vira 500 em vez de 400 — o padrão recomendado pela
  // própria documentação do Express para detectar esse caso é checar
  // `instanceof SyntaxError` combinado com a propriedade `body`.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Corpo da requisição inválido.' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}
