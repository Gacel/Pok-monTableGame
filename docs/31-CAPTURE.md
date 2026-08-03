# 31 · Captura ("tazos") — Épica 8

> Modo **Survival** (1J vs IA con equipo propio), **captura al derrotar**, **pérdida real**
> con recuperación en tienda, y **robo PvP** en Battle Royale. Se apoya en la identidad de
> instancia `ownedId` (Épica 6). Se extiende ticket a ticket. Vigente desde 2026-08-03.

## Modelo (decisión del usuario)

**Survival = equipo propio + captura real.** Llevas tu equipo del **inventario** (picker); la
IA usa Pokémon **salvajes** (pool aleatorio, sin `ownedId`). Al derrotar a un salvaje lo
**capturas** (nueva instancia 🎯). Si te matan a uno tuyo, lo **pierdes** de verdad
(recuperable en tienda por 10000). En **Battle Royale** el KO **roba** la instancia del rival.

## T8.1 — Modo Survival (1J vs IA)

**Qué cambia:**
- **`GameMode 'survival'`** ([`lobby.ts`](../packages/shared/src/lobby.ts)).
- **Arranque** ([`MatchManager.startMatch`](../services/game-service/src/services/MatchManager.ts)):
  acepta `ownerUserId`; en Survival el **player1** son `ownedId[]` (equipo propio, validado con
  `allOwnedBy` — solo tus instancias libres) y el **player2**, nombres de especie (IA salvaje,
  sin `ownedId`). `resolveSurvivalTeams` los resuelve. Se guarda `localMeta = { gameMode,
  ownerUserId }` para atribuir capturas/pérdidas al humano (T8.2/T8.3).
- **Endpoint** ([`GameController.start`](../services/game-service/src/controllers/GameController.ts)):
  admite `gameMode:'survival'`, exige sesión y pasa `reqUserId`. `asNameArray` amplía el tope a
  40 chars para admitir `ownedId` (UUID de 36) además de nombres.
- **Frontend**: botón **SURVIVAL MODE** habilitado
  ([`SinglePlayerMenuView`](../services/frontend/src/views/hub/SinglePlayerMenuView.ts)) →
  `startSurvival(level)` ([`main.ts`](../services/frontend/src/main.ts)): elige tu equipo con
  el **picker de inventario** (`OwnedTeamPickerView`), la IA saca 3 salvajes del `draft-pool`
  (`pickAiTeam`), y arranca la partida con `gameMode:'survival'` (P1 humano, P2 bot).

**Nota:** la captura, la pérdida y el robo son T8.2–T8.4; T8.1 deja el modo **jugable** (tu
equipo real vs salvajes) y el andamiaje de atribución (`localMeta`).

**Verificación:** `tsc` limpio en los 3 workspaces, build + contenedores OK. Smoke: el modo
arranca desde el menú con el equipo del inventario. Los tests con lógica pura llegan con la
captura (T8.2).

## T8.2 — Captura al derrotar (backend)

**Qué cambia:**
- **`defeats`** (engine + [`MatchStateDTO`](../packages/shared/src/match.ts)) lleva ahora
  `victimOwnedId?` (instancia de la víctima, si era propia → robo) y `victimName?` (especie →
  capturar salvaje). Se rellena en los 3 KOs: cast, dash y knockback.
- **Modelo** ([`OwnedPokemonModel.capture`](../services/game-service/src/models/OwnedPokemonModel.ts)):
  crea una **nueva** instancia (`acquired_via='capture'`) para un salvaje (no transfiere:
  los salvajes no tenían instancia). `transfer` (ya existía) roba una instancia rival.
- **Servicio** ([`CaptureService.resolve(gameMode, slotUser, state)`](../services/game-service/src/services/CaptureService.ts)):
  por cada KO con **ganador humano**:
  - `survival` → si la víctima es **salvaje** (sin `ownedId`): `capture(ganador, especie)` 🎯.
  - `br` → si la víctima es una **instancia** rival: `transfer(ownedId, ganador)` (robo, T8.4).
  Devuelve `CaptureResult[]` (`{slot, name, kind:'capture'|'steal'}`) para el feedback.
- **Wiring** ([`GameActionService`](../services/game-service/src/services/GameActionService.ts)):
  en el path **local**, si `localMeta.gameMode === 'survival'`, resuelve capturas con
  `slotUser = { player1: ownerUserId }` y difunde un mensaje `{ type:'capture', captures }`.
  (El path **online/br** se engancha en T8.4.)

**Verificación:** [`test/capture.test.ts`](../services/game-service/test/capture.test.ts) —
Survival: captura el salvaje derrotado por el humano (nueva instancia, `acquired_via='capture'`);
NO captura si el KO lo hace la IA, ni una instancia propia, ni en modos sin captura. BR: el
ganador roba la instancia rival (cambia de dueño). game-service **113/113**, `tsc` limpio.
