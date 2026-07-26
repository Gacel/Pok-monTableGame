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

## T3.2 — Deslizamiento de empuje (frontend) *(pendiente)*

## T3.3 — Dash / desplazamiento-ataque (backend) *(pendiente)*

## T3.4 — Deslizamiento de dash (frontend) *(pendiente)*
