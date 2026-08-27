# 33 · Intercambio entre jugadores (Épica 10)

> Intercambio de **Pokémon + objetos + monedas** entre amigos con **escrow** (patrón de las
> subastas), UI de oferta/aceptación, y las **evoluciones por intercambio** de Gen 1. Se apoya
> en las instancias con `ownedId` (Épica 6) y en la resolución de evolución (T9.1). Se extiende
> ticket a ticket. Vigente desde 2026-08-03.

## T10.1 — Backend de intercambio (con escrow)

**Modelo:**
- Tabla **`trades`** (`from_user`, `to_user`, `offer_json`, `request_json`, `status`):
  `offer` = lo que da el proponente (retenido), `request` = lo que pide al destinatario.
  [`TradeModel`](../services/game-service/src/models/TradeModel.ts) (create/find/setStatus/
  listPendingFor).
- Columna **`owned_pokemon.trade_id`** (escrow): retiene la instancia ofertada; excluida de
  `listByUser`/`allOwnedBy`. `OwnedPokemonModel.setTrade`/`completeTrade`.

**Servicio** ([`TradeService`](../services/game-service/src/services/TradeService.ts)):
- `propose(from, to, offer, request)`: valida **amistad** (`FriendModel.areFriends`) y que el
  proponente **posee lo ofertado libre**; crea el trade y **retiene en escrow** lo ofertado
  (Pokémon→`trade_id`; objetos y monedas se **descuentan** al proponente).
- `accept(id, by=destinatario)`: valida que el destinatario **posee lo pedido AHORA**; entrega
  lo ofertado (escrow) al destinatario y lo pedido al proponente. Estado `completed`.
- `cancel(id, by)`: cualquiera de los dos; **devuelve el escrow** al proponente. Estado
  `cancelled`.
- `listFor(user)`: intercambios **pendientes** (entrantes y salientes).

**HTTP** ([`TradeController`](../services/game-service/src/controllers/TradeController.ts) +
[`trade.routes.ts`](../services/game-service/src/routes/trade.routes.ts)): `GET /api/trades`
(enriquecido con nombre/nivel de los Pokémon para la UI), `POST /api/trades`,
`POST /api/trades/:id/accept`, `POST /api/trades/:id/cancel`.

**Nota:** extiende el "regalar" existente (transferencia unidireccional) con un flujo
bidireccional confirmado por ambos. La UI es **T10.2**; las evoluciones por intercambio, **T10.3**.

**Verificación:** [`test/trade.test.ts`](../services/game-service/test/trade.test.ts) — el
escrow saca lo ofertado del inventario del proponente; solo con amigos; `accept` cruza las
propiedades (`acquired_via='trade'`); solo el destinatario acepta; `cancel` reembolsa el
escrow (Pokémon + monedas); no puedes ofertar lo que no tienes. game-service **135/135**,
`tsc` limpio, contenedor OK.

## T10.3 — Evoluciones por intercambio

**Qué añade:** al **completar** un intercambio, cada instancia recién movida (de ambos lados)
comprueba con el catálogo (`getEvolution`, T9.1) si evoluciona por **`trade`** y, si es así, se
aplica — fiel a Gen 1: **Kadabra→Alakazam, Machoke→Machamp, Graveler→Golem, Haunter→Gengar**.
[`TradeService.applyTradeEvolution`](../services/game-service/src/services/TradeService.ts),
enganchado en `accept` tras cruzar las propiedades. Silencioso para los que no evolucionan por
intercambio.

**Verificación:** [`test/tradeEvolution.test.ts`](../services/game-service/test/tradeEvolution.test.ts)
— un Kadabra intercambiado llega como **Alakazam** a quien lo recibe; funciona también en el
lado pedido (Machoke→Machamp); los de otro disparador (Pikachu, piedra) no cambian.
game-service **138/138**, `tsc` limpio, contenedor OK.

## T10.2 — UI de intercambio

- **Proponer** desde el inventario ([`InventoryView`](../services/frontend/src/views/hub/InventoryView.ts)):
  menú contextual **🔄 Intercambiar** en un Pokémon → diálogo que **ofrece** esa instancia a un
  **amigo** y le **pide N monedas** (`POST /api/trades`). Reutiliza el picker de amigos del
  "regalar".
- **Gestionar** desde Comunidad ([`CommunityMenuView`](../services/frontend/src/views/hub/CommunityMenuView.ts)):
  botón **INTERCAMBIOS** → panel con los pendientes (entrantes/salientes, con lo ofertado y lo
  pedido). Entrantes: **ACEPTAR** / RECHAZAR; salientes: **CANCELAR** (`.../accept`,
  `.../cancel`). Al aceptar, el escrow y lo pedido se cruzan (y disparan las evoluciones por
  intercambio de T10.3).

**Alcance (MVP):** la oferta de la UI es *un Pokémon a cambio de monedas* (el backend soporta
Pokémon+objetos+monedas en ambos lados). **Pedir un Pokémon concreto del amigo** requiere ver su
inventario (endpoint aparte) → follow-up.

**Verificación:** `tsc` limpio, build + contenedor OK. Se puede montar una oferta desde el
inventario, verla y aceptarla/cancelarla desde Comunidad.

---

**Épica 10 cerrada** (T10.1 → T10.3 → T10.2). Intercambio con escrow entre amigos, UI de
oferta/gestión y las 4 evoluciones por intercambio de Gen 1. **Con esto se completa el roadmap
del doc 12** (Épicas 0–10 + A + G + fixes).
