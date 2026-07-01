import { buildApp } from './app.js';
import { matchManager } from './services/MatchManager.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SERVICE = 'game-service';

const app = buildApp();

async function main(): Promise<void> {
  // Carga o crea la partida por defecto (reanuda si existía en SQLite).
  await matchManager.init();

  // Graceful shutdown: vuelca el estado de la partida antes de salir (C4.2).
  let shuttingDown = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      app.log.info(`${signal} recibido, persistiendo estado y cerrando…`);
      try {
        await matchManager.persistAll();
        await app.close();
      } finally {
        process.exit(0);
      }
    });
  }

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`[${SERVICE}] escuchando en http://${HOST}:${PORT}`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
