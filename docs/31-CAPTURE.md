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
