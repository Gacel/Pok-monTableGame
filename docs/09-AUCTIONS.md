# Casa de subastas

> Mercado entre jugadores: un vendedor pone un **Pokémon** o un **objeto** a la venta;
> el resto puja o lo compra. Servidor autoritativo (valida saldo, propiedad y estado).

## Modos de venta (combinables)
Un lote puede tener **precio de salida** (puja mínima), **precio fijo** ("cómpralo ya"),
o **ambos**. Con ambos, los jugadores pujan o alguien compra ya y la subasta termina.

## Duraciones y tarifas
| Duración | Comisión al vender | Tarifa si NO se vende |
|----------|--------------------|-----------------------|
| 12h | 5% del precio de venta | 100 monedas |
| 24h | 10% | 200 monedas |
| 48h | 15% | 400 monedas |

Las tarifas se cobran **al liquidar**: si se vende, la comisión se descuenta de lo que
cobra el vendedor; si expira sin venderse, se le cobra la tarifa plana (sin dejar el
saldo en negativo) y se le devuelve el lote.

## Escrow
- El **Pokémon/objeto** se retira del inventario al publicar (columna `owned_pokemon.auction_id`
  o decremento de `owned_items.qty`) y se devuelve si no se vende o se cancela.
- Las **pujas** retienen monedas: al pujar se descuentan; al ser superado, se reembolsan.

## Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/auctions` | Subastas activas (liquida vencidas primero) |
| GET | `/api/auctions/mine` | Mis subastas (historial) |
| POST | `/api/auctions` | Publicar (kind, pokemonId/itemKind+itemKey, startingPrice?, buyNowPrice?, durationHours) |
| POST | `/api/auctions/:id/bid` | Pujar (amount) |
| POST | `/api/auctions/:id/buy` | Comprar ya |
| POST | `/api/auctions/:id/cancel` | Cancelar (solo si no tiene pujas) |

## Liquidación
`AuctionService.settleExpired()` cierra las subastas vencidas; se invoca de forma
perezosa al listar (`/api/auctions`, `/mine`) y antes de pujar/comprar. Idempotente.

## Pendiente
- Barrido periódico en segundo plano (hoy la liquidación es perezosa al consultar).
- Notificaciones al vendedor/comprador; historial de pujas por subasta.
