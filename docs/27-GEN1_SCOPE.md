# GEN1_SCOPE.md — Scope Gen 1 (#1-151) y catálogo de especies (Épica 5)

> Documento de la **Épica 5** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> clamp a los 151 de Gen 1 y catálogo de cadenas de evolución. Se extiende ticket a ticket.
> Vigente desde 2026-07-14.

## T5.1 — Clamp a #1-151 (fuente única de verdad)

**Qué:** el juego usa exactamente los **151 Pokémon de Gen 1**, de forma consistente en
loot, tienda y starters (antes la loot pool tenía 200, #1-200, con Gen 2). D11.

**Cómo:**
- [`engine/gen1.ts`](../services/game-service/src/engine/gen1.ts): `GEN1_NAMES` (los 151
  slugs de PokeAPI) e `isGen1(name)` — **fuente única de verdad**.
- [`services/lootPool.ts`](../services/game-service/src/services/lootPool.ts): regenerada
  filtrando el pool #1-200 a Gen 1 → **151** repartidos en 4 tiers por poder (35/41/35/40).
  La tienda y los cofres tiran de aquí (`loot.ts` `pickFromTier`), así que ya solo conceden
  Gen 1.
- `STARTER_POOL` (`MatchManager`) ya era todo Gen 1 (sin cambios).

**Nota (desviación):** `PokemonService.getTemplate` **no rechaza** nombres fuera de Gen 1;
sigue sirviéndolos para no romper Pokémon Gen 2 que algún usuario ya tuviera del pool #1-200
anterior. Lo que se clampa son las **fuentes que conceden** (loot/tienda/starters), que es lo
que garantiza "ningún flujo nuevo instancia fuera de #1-151".

**Verificación:** [`test/gen1.test.ts`](../services/game-service/test/gen1.test.ts) — 151 sin
duplicados, `isGen1` (acepta Gen 1, rechaza Gen 2+), la loot pool cubre **exactamente** los
151 y los starters son todos Gen 1. game-service 75/75, `tsc` limpio.

## T5.2 — Catálogo de especies: cadenas de evolución *(pendiente)*
