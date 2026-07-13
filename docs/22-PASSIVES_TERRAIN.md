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

## T2.2 — Curación de Planta en hierba + daño de pantano *(pendiente)*

## T2.3 — Números flotantes de daño/curación *(pendiente)*
