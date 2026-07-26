# TACTICAL_MOVES.md — Movimientos tácticos: empuje y dash (Épica 3)

> Documento de la **Épica 3** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> desplazamientos provocados por ataques (knockback, dash) y su feedback. Se extiende
> ticket a ticket. Vigente desde 2026-07-14.

## T3.1 — Empuje / Knockback (backend)

**Qué:** algunos ataques **empujan** al defensor hacia atrás tras el impacto.

**Decisión D2:** distancia por movimiento (1-3); **Large inmunes**; **colisión = 10% maxHp**.

**Cómo:**
- `PokemonMove.knockback?` ([`domain.ts`](../packages/shared/src/domain.ts)).
- Lista curada (D5) en [`engine/moveTactics.ts`](../services/game-service/src/engine/moveTactics.ts)
  (`KNOCKBACK_MOVES`, `getKnockback`) — solo moves con daño (los `status` se filtran): p. ej.
  `dragon-tail` 2, `circle-throw` 2, `bulldoze`/`stomp`/`headbutt`… 1. `toMove` fija `mv.knockback`.
- `engine/hex.ts` `hexDirection(a, b)`: dirección unitaria (1 de 6) atacante→defensor.
- [`GameService.applyKnockback`](../services/game-service/src/services/GameService.ts): tras
  el daño directo, si el defensor sobrevive y el move tiene `knockback`, se mueve `distance`
  hexes en esa dirección con `board.moveOccupant`. **Large inmunes**. Si choca con
  **obstáculo/pieza/borde** (`getTile`/`getOccupant`/`canEnter`), se detiene y recibe **10%
  maxHp** (que puede ser KO). Emite evento **`knockback`** (`from`→`to`) y, si colisiona,
  `damage`/`ko`.

**Verificación:** [`test/knockback.test.ts`](../services/game-service/test/knockback.test.ts)
— valores curados, empuje en la dirección correcta + evento, colisión (bloqueo + 10%),
inmunidad Large. game-service 61/61, `tsc` limpio.

## T3.3 — Dash / desplazamiento-ataque (backend)

**Qué:** algunos ataques **lanzan al atacante** en línea hacia el objetivo, dañando lo que
embiste, para cerrar distancias.

**Cómo:**
- `PokemonMove.dash?` ([`domain.ts`](../packages/shared/src/domain.ts)); lista curada
  `DASH_MOVES`/`isDash` en [`moveTactics.ts`](../services/game-service/src/engine/moveTactics.ts)
  (`quick-attack`, `extreme-speed`, `aqua-jet`, `mach-punch`…). Su **alcance** vive en
  `MOVE_SHAPES` (range del dash). `toMove` fija `mv.dash`.
- [`GameService.castDash`](../services/game-service/src/services/GameService.ts) (reutiliza
  `cast`, que ya validó turno/propiedad/rango): traza la línea `hexLineDraw(from, target)`,
  daña al **primer enemigo** que embiste (con KO/revelado como el AoE) y aterriza en la
  **última casilla libre** de la trayectoria (junto al objetivo). Si mata a lo que embiste,
  **avanza a su casilla**. Emite evento **`dash`** (`from`→`to`).

**Verificación:** [`test/dash.test.ts`](../services/game-service/test/dash.test.ts) —
`isDash`, aterrizaje junto al objetivo + daño + evento, reposición a casilla libre, avanzar
a la casilla del KO. game-service 65/65.

## T3.2 / T3.4 — Deslizamientos de empuje y dash (frontend)

**Qué:** que el sprite **deslice** de forma visible a su nueva casilla tras un empuje
(`knockback`) o un dash, en vez de saltar.

**Cómo:** en vez de tweens que pelean con el reposicionado de `EntityView`, se reutiliza la
transición CSS de `left/top`, alargándola solo para el sprite que se desplaza:
- `GameState.slidingIds: Set<string>` — ids que deslizan en el próximo render (one-shot).
- [`GameController.dispatchEvents`](../services/frontend/src/controllers/GameController.ts):
  al recibir `knockback`/`dash`, añade `ev.pokemonId` a `slidingIds`.
- [`EntityView`](../services/frontend/src/views/EntityView.ts): para un sprite en
  `slidingIds` (y sin cámara en movimiento) usa una transición `left/top` de **0.28s
  ease-out** (sprite/base/label) → cuando `EntityView` lo coloca en su nuevo hex, se
  desliza. Se limpia `slidingIds` al final del render (un solo desplazamiento).

**Verificación:** `tsc` frontend limpio, tests 17/17. *(Smoke visual pendiente: el tooling de
Docker Compose se cayó en el entorno; ver nota al cerrar la Épica 3.)* **Cierra la Épica 3.**
