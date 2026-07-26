import { createApp } from './app';
import { port, droneSpecs, storageDriver, databaseFile } from './config';

const { app, close } = createApp({ driver: storageDriver, databaseFile });

const server = app.listen(port, () => {
  console.log(`🚁 Drone Delivery Simulator rodando em http://localhost:${port}`);
  console.log(`   Drone specs: max ${droneSpecs.maxWeightKg}kg, ${droneSpecs.maxRangeKm}km por carga`);
  console.log(
    storageDriver === 'sqlite'
      ? `   Persistência: SQLite (${databaseFile})`
      : `   Persistência: em memória (os dados somem ao encerrar)`
  );
});

// Fecha a conexão do banco ao encerrar, para não deixar o arquivo WAL pendente.
function shutdown(): void {
  server.close(() => {
    close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
