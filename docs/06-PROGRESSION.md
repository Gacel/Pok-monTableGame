# PROGRESSION.md — Economía, inventario, starters y chat persistente

> Documento vivo. Cubre la progresión del jugador: monedas, Pokémon propios
> (inventario), starters de primer login, chat persistente y el uso de Pokémon
> propios en ARENA. Rama de trabajo: `feat/inventory-economy-chat`.
>
> **Leyenda:** ✅ hecho · 🟧 parcial · ⬜ pendiente.

---

## 1. Monedas ✅

- Todos los jugadores empiezan con **5000 monedas** (`users.coins DEFAULT 5000`;
  `UserModel.create`/`createWithEmail`). Usuarios previos (dev) no se migran.
- **Economía en partida** (online y ARENA; el local hot-seat NO acredita porque no
  hay usuarios por slot):
  - **+500** al jugador por cada **Pokémon enemigo vencido (KO)**.
  - Al **ganar** una partida se reparte un **pool = 1000 × nº de perdedores** entre
    los ganadores:
    - 1 vs 1 → **1000** al ganador.
    - 2 vs 2 → **1000** a cada uno de los 2 ganadores (pool 2000/2).
    - 4 todos-contra-todos → **3000** al único ganador (pool 3000/1).
- Implementación: `GameService` acumula `defeats` `{killerSlot,victimSlot}` por
  acción (efímero, en el DTO, no serializado) en los puntos de KO
  (`combatAction`: daño y HUIR). `OnlineGameController.commit` (embudo online+arena)
  acredita con `UserModel.addCoins`, resolviendo slot→userId con
  `RoomService.slotUserMap`. Fórmula del pool:
  `perGanador = floor(1000 × (nºjugadores − nºganadores) / nºganadores)`.

---

## 2. Inventario y Pokémon propios ✅

- Tablas (`db.ts`): `owned_pokemon` (instancia por fila: `id, user_id, name, level,
  is_starter, acquired_via`) y `owned_items` (`user_id, kind, item_key, qty`).
- Modelos: `OwnedPokemonModel` (`listByUser/countByUser/grantMany/transfer/findById`),
  `ItemModel` (`listByUser/add`).
- Endpoint `GET /api/inventory` → `{ pokemon[], items[] }` (Pokémon enriquecidos con
  stats vía `PokemonService.getTemplate`; sin exponer datos sensibles).
- **UI**: `InventoryView` a **pantalla completa** (capa `#inventory-layer`, ocupa la
  pantalla como el mapa). Izquierda: entrenador (≥50% alto). Derecha: dos secciones
  con scroll — arriba **Pokémon obtenidos**, abajo **Objetos** (cosméticos, pokéballs
  con sprite bitmap) — en cuadrícula. Se abre pulsando el **avatar** del menú principal.

---

## 3. Starters (primer login) ✅

- Pool de **12 opciones balanceadas** por poder (`STARTER_POOL` en `MatchManager`):
  charmander, squirtle, bulbasaur, pikachu, eevee, growlithe, psyduck, oddish,
  clefairy, ekans, poliwag, vulpix. El jugador elige **3** (`STARTER_PICK`).
- Backend: `GET /api/starters/options` (12 con stats), `POST /api/starters`
  (valida 3 distintos del pool y `grantMany` como `is_starter`, solo si aún no tiene).
- Gating: `/users/me` expone `pokemonCount`; el frontend (`main.ts`) muestra
  `StarterSelectionView` cuando el usuario tiene `username` pero 0 Pokémon.

---

## 4. Chat directo persistente ✅

- Tabla `messages` (`dm_room, from_id, text, created_at`) + `MessageModel`
  (`add/history`). Al abrir un chat `dm:` el WS envía el **historial** (últimos 50);
  cada mensaje DM se **persiste**. El chat de sala de juego sigue efímero.
- Frontend: `WsClient` soporta `chat_history`; `CommunityMenuView.renderDm` carga el
  histórico al abrir el chat.

---

## 5. ARENA y BATTLE ROYALE con Pokémon propios ✅

- Modos que usan el inventario del jugador: `OWNED_TEAM_MODES = ['br','arena']`
  (nuevo `GameMode 'br'`). En estos modos **no hay draft**: el jugador elige entre
  **sus propios Pokémon** (`OwnedTeamPickerView`); los demás no aparecen.
- **ARENA**: `joinArena` valida que el equipo ⊂ `owned_pokemon` del usuario (sin
  unicidad cruzada). Entrada directa vía `startArena` → picker de inventario.
- **BATTLE ROYALE**: `gameMode 'br'` (FFA con propios). El lobby usa el picker de
  inventario (`showOnlineDraft` → `OwnedTeamPickerView` para modos propios);
  `submitTeam` valida el equipo contra el inventario (sin reserva cruzada);
  `createGame` usa `resolveOwnedTeams`. **1v1/2v2 mantienen el draft de roster.**
- Verificado e2e: BR crea sala `br`, acepta equipo propio (200) y rechaza no-propio
  (400); ARENA acepta propios (200).

### Reseteo de jugadores

Se **borraron todos los registros de jugadores** (users/owned_pokemon/owned_items/
friendships/friend_requests/messages/matches) para partir de cero: cada jugador
nuevo empieza con **5000 monedas** y pasa por Welcome → Login/Register. `checkSession`
devuelve a Welcome si el token ya no corresponde a un usuario.

### Pendiente (⬜) — siguiente iteración

- **BR local (hot-seat)**: sigue con draft de roster (el inventario propio es por
  usuario; en local no hay dueño para los asientos 2-4). BR online sí usa propios.
- **Captura en Survival:** transferir al ganador el Pokémon derrotado
  (`OwnedPokemonModel.transfer`) requiere: modo/flag `survival`, inyectar el mapa
  `slot→userId` y el `ownedId` de cada Pokémon en el motor (`board.ts:Pokemon`,
  `placements`), y engancharlo en `GameService.finalizeCombat` justo antes de retirar
  la pieza KO. Ver [`05-FRONTEND_MENU.md` §4.3](05-FRONTEND_MENU.md).

---

## 6. Loot de pokéballs (tienda) ✅

- **Pool v1.0.0 de ~200 Pokémon** (`lootPool.ts`, PokeAPI #1-200) — DISTINTOS al draft
  de 23: las bolas son la vía para conseguir Pokémon fuera del roster. Repartidos en
  4 **tiers** por poder (suma de stats base, cuartiles, 50/50/50/50): T1 Común · T2
  Raro · T3 Épico · T4 Legendario. Regenerable con `scratchpad/genpool.mjs`.
- Los Pokémon looteados (fuera del roster) se usan en arena/BR: `resolveOwnedTeams` y
  `addToArena` resuelven cualquier nombre vía `PokemonService.getTemplate` (cache-first).
- La tienda **no muestra** el ratio de "bueno" por bola. El inventario usa casillas
  pequeñas (grid 60px) para caber más columnas con menos scroll.
- Cada bola tiene una distribución de tiers (a más cara, más Pokémon buenos):

  | Bola (precio) | T1 | T2 | T3 | T4 | bueno (T3+T4) |
  |---|---|---|---|---|---|
  | Normal (500) | 70 | 22 | 7 | 1 | 8% |
  | Super (1000) | 45 | 33 | 17 | 5 | 22% |
  | Ultra (2000) | 22 | 33 | 30 | 15 | 45% |
  | Master (10000) | 5 | 20 | 35 | 40 | 75% |

- Compra autoritativa: `POST /api/shop/ball {ball}` valida saldo (402 si no llega),
  resta monedas, tira el tier (`rollTier`) y concede un Pokémon aleatorio del tier
  al inventario (`acquired_via='shop'`). `GET /api/shop/balls` expone precios/odds.
- Frontend: `ShopMenuView` → botones de bola activos según saldo, revelado del
  Pokémon obtenido (sprite + tier) y saldo actualizado.
- Rama: `feat/shop-loot`. Verificado e2e (config, compra, 402 sin saldo, distribución
  10×Normal → 7 T1 / 2 T2 / 1 T3 / 0 T4).

## 7. Commits (rama `feat/inventory-economy-chat`)

Cada cambio va en su propio commit + push:
`5000 monedas` · `owned_pokemon/owned_items + modelos` · `chat DM persistente` ·
`starters 3/12 + endpoint inventario` · `inventario full-screen` ·
`economía 500/KO + pool victoria` · `ARENA con pokémon propios`.
