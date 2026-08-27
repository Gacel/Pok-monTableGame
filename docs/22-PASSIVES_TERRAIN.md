# PASSIVES_TERRAIN.md — Pasivas y terreno avanzado (Épica 2)

> Documento de la **Épica 2** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> pasivas de tipo y efectos de terreno. Se extiende ticket a ticket. Vigente desde
> 2026-07-14.

## T2.1 — Fantasmas atraviesan unidades

**Por qué:** los Pokémon de tipo Fantasma ya atravesaban el terreno sin penalización
(coste 1 en `environment.ts`, `canEnter` siempre `true`), pero el Dijkstra de
`getMoveOptions` **cortaba al encontrar cualquier pieza** — un Fantasma no podía pasar por
detrás de una unidad. T2.1 lo permite (posicionamiento etéreo).

**Decisión D1:** paso libre por **todos** (aliados y enemigos), **sin ataque de
oportunidad**; solo **no puede terminar en casilla ocupada**.

**Cómo** ([`engine/movement.ts`](../services/game-service/src/engine/movement.ts),
`getMoveOptions`): en el bloque de casilla ocupada, si `pokemon.type === 'GHOST'` se
**expande el Dijkstra a través** de la casilla (coste `getTerrainCost` = 1) registrándola
en `costSoFar`/`queue`, pero **sin añadirla a `moves`** (no es destino válido). Se conserva
el marcado de enemigo adyacente como objetivo de ataque; a los aliados no se les ataca. El
no-Fantasma mantiene el bloqueo por ocupantes.

Como los destinos válidos (`moves`) siguen siendo solo casillas vacías, `GameService.play`
(que valida contra `opts.moves`) ya rechaza terminar sobre una pieza.

**Verificación:** [`test/movement.test.ts`](../services/game-service/test/movement.test.ts)
— no-Fantasma bloqueado; Fantasma alcanza la casilla de detrás sin poder terminar en la
ocupada; atraviesa aliados sin atacarlos; ninguna ocupada aparece en `moves`. game-service
43/43, `tsc` limpio, imagen Docker sana.

## T2.2 — Curación de Planta en hierba alta + pantano visible

**Por qué:** T0.2 dejó la maquinaria de efectos de fin de turno (`applyEndOfTurnEffects`:
clamp, eventos `damage`/`heal`/`ko`, logs), pero **ningún terreno curaba** todavía.

**Cómo:**
- [`engine/environment.ts`](../services/game-service/src/engine/environment.ts)
  `terrainDamage`: si `TALL_GRASS` y tipo `GRASS`, devuelve **`-Math.round(0.08 * maxHp)`**
  (negativo = curación de **8% maxHp/turno**, D9). Los demás tipos, 0.
- [`GameService.applyEndOfTurnEffects`](../services/game-service/src/services/GameService.ts):
  refinado para emitir el **delta REALMENTE aplicado** (`applied = hp - before`): curar a
  HP lleno no emite un `heal` "+N" fantasma; si `applied === 0` se omite. El daño de
  lava/pantano y el KO por terreno siguen igual (con la magnitud real en el log).

Un Pokémon de Planta **oculto** en hierba alta se cura sin revelarse (solo el AoE revela,
T1.1); su evento `heal` queda censurado por niebla para el rival (visible para el dueño).

**Verificación:** `test/environment.test.ts` — `terrainDamage(TALL_GRASS, GRASS) = -8`;
integración: Planta con HP bajo recupera 8% y emite `heal`; clamp a maxHp con delta real;
a HP lleno sin evento. game-service 46/46.

## T2.3 — Números flotantes de daño/curación (frontend)

**Cómo:** [`GameController.dispatchEvents`](../services/frontend/src/controllers/GameController.ts)
añade `case 'heal'` → `fxLayer.floatingNumber(hex, '+N', 'heal')` (verde). El número de
daño (`-N` rojo) de combate **y de fin de turno** (lava/pantano) ya se pintaba desde T0.4
(caso `damage`). `FxLayer.floatingNumber` ya soporta el `kind:'heal'`.

**Verificación:** `tsc` de mi cambio limpio, tests frontend 17/17; OK visual del usuario
(`+N` verde al curarse una Planta en hierba; `-N` rojo en pantano). **Cierra la Épica 2.**
