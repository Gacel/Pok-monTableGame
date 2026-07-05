import { FastifyInstance } from 'fastify';
import { AuctionController } from '../controllers/AuctionController.js';

export async function auctionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auctions', AuctionController.list);
  app.get('/api/auctions/mine', AuctionController.mine);

  app.post(
    '/api/auctions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['kind', 'durationHours'],
          properties: {
            kind: { type: 'string', enum: ['pokemon', 'item'] },
            pokemonId: { type: 'string', maxLength: 64 },
            itemKind: { type: 'string', maxLength: 32 },
            itemKey: { type: 'string', maxLength: 64 },
            startingPrice: { type: ['integer', 'null'], minimum: 1 },
            buyNowPrice: { type: ['integer', 'null'], minimum: 1 },
            durationHours: { type: 'integer', enum: [12, 24, 48] },
          },
        },
      },
    },
    AuctionController.create
  );

  app.post(
    '/api/auctions/:id/bid',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } },
        body: {
          type: 'object',
          required: ['amount'],
          properties: { amount: { type: 'integer', minimum: 1 } },
        },
      },
    },
    AuctionController.bid
  );

  app.post('/api/auctions/:id/buy', AuctionController.buy);
  app.post('/api/auctions/:id/cancel', AuctionController.cancel);
}
