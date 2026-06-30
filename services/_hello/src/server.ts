import Fastify from 'fastify';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SERVICE = 'hello';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

const startedAt = Date.now();

app.get('/health', async () => ({
  status: 'ok' as const,
  service: SERVICE,
  uptime: Math.floor((Date.now() - startedAt) / 1000),
}));

app.get('/', async () => ({
  message: 'Transcendence Pokémon Edition — pipeline OK',
  service: SERVICE,
}));

// Graceful shutdown (patrón que reutilizaremos en game-service, C4.2)
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} recibido, cerrando…`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`[${SERVICE}] escuchando en http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
