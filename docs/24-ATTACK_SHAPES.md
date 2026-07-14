# ATTACK_SHAPES.md — Sistema de ataques: rango, forma y selección (Épica A)

> Documento de la **Épica A** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> rango/forma (AoE) de los ataques, selección de moves y previsualización. Se extiende
> ticket a ticket. Vigente desde 2026-07-14.

## TA.1 — Catálogo de rango y forma (AoE) por movimiento

**Por qué:** el combate on-map usa `move.range`/`move.aoe`, pero se derivaban con una
heurística rudimentaria (`PokemonService.toMove`): rangos irreales, formas sin sentido y
`radius` **castable en cualquier casilla** (exento de la validación de rango en `cast`).

**Cómo (mapeo híbrido — D5):**
- [`engine/moveShapes.ts`](../services/game-service/src/engine/moveShapes.ts) (puro,
  testeable): `MOVE_SHAPES` = **lista curada** de moves emblemáticos/relevantes de Gen 1
  (`nombre PokeAPI → { range, aoe, radius? }`) — terratemblor `radius`/range 0/radio 2,
  hiperrayo/solar-beam/hydro-pump `line`, conos, proyectiles físicos con alcance real…
  `getMoveShape(row)` usa la lista curada y, si el move no está, un **clasificador por
  defecto** a partir de `target` + `damageClass`:
  - `all-other-pokemon`/`all-pokemon` → `radius` autocentrado (range 0), radio 1.
  - `all-opponents` → `cone`, range 2.
  - `special` → `single`, range 3 (proyectil a distancia).
  - resto (físico) → `single`, range 1 (cuerpo a cuerpo).
- [`PokemonService.toMove`](../services/game-service/src/services/PokemonService.ts) llama a
  `getMoveShape` (fuera la heurística vieja).
- **Radio explícito:** `PokemonMove.radius?` ([`domain.ts`](../packages/shared/src/domain.ts))
  y `calculateAoE(attacker, target, aoe, range, radius?)`
  ([`combat.ts`](../packages/shared/src/combat.ts)) usan el radio propio, no `floor(range/2)`.
- **Fin del "rango infinito":** [`GameService.cast`](../services/game-service/src/services/GameService.ts)
  valida `dist > range` para **todos** los AoE (incluido `radius`); el auto-cast (`dist 0`)
  solo vale para ondas radiales autocentradas (`range 0`). Se pasa `move.radius` a `calculateAoE`.

**Nota:** la representación **visual** del alcance legal y el gating del preview (que el
dibujo del AoE respete el rango antes de lanzar) es **TA.3**; TA.1 solo corrige la forma/
radio dibujados y la validación autoritativa del servidor.

**Verificación:** [`test/moveShapes.test.ts`](../services/game-service/test/moveShapes.test.ts)
— catálogo (curados + defaults), `calculateAoE` con radio propio (disco de 7/19 casillas),
y validación de rango en `cast` (melee rechaza dist 2; radius ya no es lanzable lejos, solo
autocentrado). game-service 52/52, `tsc` limpio en los 3 workspaces.

## TA.2 — Selección de los 4 moves representativos (heurística)

**Por qué:** la selección elegía el top-potencia de ≤14 candidatos priorizados por método
→ se sentía arbitraria y podía llevar 4 moves del mismo tipo.

**Cómo** ([`engine/moveSelection.ts`](../services/game-service/src/engine/moveSelection.ts),
puro): `scoreMove` = **potencia + STAB (25) + bonus a emblemáticos (20)** (emblemático =
está en `MOVE_SHAPES`). `selectMoves` ordena por puntuación y hace una **1ª pasada con máx
2 por tipo** (variedad) y una **2ª de relleno** sin límite si faltan; sin duplicados.
`getCuratedMoves` ([`PokemonService.ts`](../services/game-service/src/services/PokemonService.ts))
lo usa tras hidratar, mantiene la garantía de ≥1 físico gratuito, y `CANDIDATE_CAP` sube a
**18** para no perder emblemáticos.

**Verificación:** [`test/moveSelection.test.ts`](../services/game-service/test/moveSelection.test.ts)
— STAB/emblemático puntúan sobre la potencia, se prioriza el STAB, variedad (≤2 por tipo),
relleno hasta 4, sin duplicados. game-service 57/57.

## TA.3 — Previsualización de rango y forma en el mapa

**Por qué:** con un move activo, el preview dibujaba el AoE en **cualquier** hover (sin mirar
el rango) y no mostraba el alcance legal → parecía que llegaba a cualquier sitio aunque el
`cast` lo rechazara.

**Cómo** ([`BoardView.ts`](../services/frontend/src/views/BoardView.ts)):
`buildAttackPreview()` (precalculado una vez por frame) obtiene del move QWER activo su
`range`/`aoe`/`radius`, comprueba si el hover está **dentro de rango** (misma regla que
`GameService.cast`: `dist ≤ range` y `dist ≥ 1` salvo ondas autocentradas) y, en ese caso,
el conjunto de hexes del AoE (`calculateAoE`). En el bucle de render:
- **Alcance legal** → overlay cian tenue en cada hex casteable.
- **Forma AoE** en el hover (dentro de rango) → naranja.
- **Fuera de rango** (hover) → rojo (feedback de que no llega).
Helper `hexDist` (distancia cúbica) local. Coincide con la validación autoritativa.

**Verificación:** `tsc` frontend limpio, tests 17/17, build OK. Smoke: al elegir un ataque
se ven las casillas de alcance; la forma solo se dibuja dentro de rango; fuera, aviso rojo.

## TA.5 — Traducción de moves + iconos QWER *(pendiente)*
