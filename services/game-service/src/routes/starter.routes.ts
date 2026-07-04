import { FastifyInstance } from 'fastify';
import { StarterController } from '../controllers/StarterController.js';

/** Rutas de selección de starters (primer login). Exigen JWT (hook global). */
export async function starterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/starters/options', StarterController.options);
  app.post(
    '/api/starters',
    {
      schema: {
        body: {
          type: 'object',
          required: ['names'],
          properties: {
            names: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 3 },
          },
        },
      },
    },
    StarterController.choose
  );
}
