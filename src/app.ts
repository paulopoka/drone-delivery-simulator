import express, { Application } from 'express';
import { createRepositories, Repositories, RepositoryOptions } from './repositories';
import { buildRouter } from './api/routes';
import { errorHandler } from './api/errorHandler';

export interface CreatedApp extends Repositories {
  app: Application;
}

/**
 * Monta a aplicação Express. Separado do `server.ts` para que os testes possam
 * criar instâncias isoladas sem subir um servidor HTTP.
 *
 * Sem opções, usa persistência em memória — é o que mantém a suíte de testes
 * rápida e o `clone && npm start` funcionando em qualquer ambiente.
 */
export function createApp(options: RepositoryOptions = {}): CreatedApp {
  const app = express();
  app.use(express.json());

  // CORS permissivo: este é um projeto de teste técnico rodando localmente,
  // então liberamos qualquer origem para facilitar o uso de um painel HTML
  // local ou ferramentas como Postman sem configuração extra.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const repositories = createRepositories(options);

  app.use(
    '/',
    buildRouter(
      repositories.orderRepository,
      repositories.droneRepository,
      repositories.zoneRepository
    )
  );
  app.use(errorHandler);

  return { app, ...repositories };
}
