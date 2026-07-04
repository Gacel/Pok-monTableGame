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

## 5. ARENA con Pokémon propios 🟧

- **ARENA** usa el **inventario** del jugador, no el draft: `joinArena` valida que el
  equipo sea subconjunto de `owned_pokemon` del usuario (sin unicidad cruzada — varios
  jugadores pueden llevar el mismo Pokémon). Frontend: `OwnedTeamPickerView` (elige 3
  del inventario) reemplaza al `DraftView` de roster en `startArena`.

### Pendiente (⬜) — siguiente iteración

- **Battle Royale con Pokémon propios:** hoy BR sigue por el lobby con `DraftView` +
  `submitTeam` (valida contra `ROSTER_NAMES` + `reservedByOthers`). Falta que BR use el
  inventario (nueva `resolveOwnedTeams` sin unicidad cruzada y selector de inventario
  en el lobby, análogo a ARENA).
- **Captura en Survival:** transferir al ganador el Pokémon derrotado
  (`OwnedPokemonModel.transfer`) requiere: modo/flag `survival`, inyectar el mapa
  `slot→userId` y el `ownedId` de cada Pokémon en el motor (`board.ts:Pokemon`,
  `placements`), y engancharlo en `GameService.finalizeCombat` justo antes de retirar
  la pieza KO. Ver `docs/FRONTEND_MENU.md §4.3`.

---

## 6. Commits (rama `feat/inventory-economy-chat`)

Cada cambio va en su propio commit + push:
`5000 monedas` · `owned_pokemon/owned_items + modelos` · `chat DM persistente` ·
`starters 3/12 + endpoint inventario` · `inventario full-screen` ·
`economía 500/KO + pool victoria` · `ARENA con pokémon propios`.
