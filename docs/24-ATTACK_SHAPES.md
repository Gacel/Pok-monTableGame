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

## TA.5 — Traducción de moves + iconos QWER

**Traducción (ya funcionaba end-to-end):** `PokemonService.hydrateMove` guarda el nombre
**en español** de PokeAPI (`names[]`, `language.name === 'es'`) en `MoveRow.displayName`;
`toMove` lo propaga; [`HUDView`](../services/frontend/src/views/HUDView.ts) ya muestra
`m.displayName` (o el slug como fallback) en la barra QWER. También traduce el tipo.

**Iconos QWER:** cada botón muestra ahora un **icono representativo del tipo** (mapa
`MOVE_TYPE_EMOJI`, p. ej. 🔥/💧/🌿/⚡/👻…) como icono principal, con un **badge de clase**
(⚔️ físico / 🔮 especial / 🛡️ estado) en la esquina, además del nombre y tipo traducidos.
Es **provisional con emoji**: el arte definitivo (iconos estilo LoL, imagen de referencia
aportada por el usuario; ver memoria `move-ability-icons-style`) se dejará en
`public/assets/icons/{tipo}.png` y sustituirá a los emojis en un follow-up (el usuario
aporta el PNG). La `img-src` del CSP ya permite `'self'` para esos assets.

**Verificación:** `tsc` frontend limpio, build OK. Smoke: los botones QWER muestran nombre
traducido + icono de tipo + badge de clase.

## FIX-ondas — Autocentradas lanzables por colosos (terratemblor con Snorlax)

**Síntoma (usuario):** «no puedo hacer terratemblor con Snorlax porque el rango de ataque es
igual a las casillas que ocupa el Pokémon, por tanto no puede haber ningún enemigo ahí».

**Causa raíz:** una onda **autocentrada** (radial con `range 0`: terratemblor, surf,
autodestrucción…) debe centrarse **sobre el propio lanzador**, pero:
1. La validación exigía que la casilla clicada estuviera a `dist ≤ 0` del **hex-centro**. Un
   coloso ocupa 7 hexes; clicar cualquiera de los otros 6 daba «fuera de rango» → en la
   práctica, imposible de lanzar.
2. El `radius 2` partía del centro, pero el **cuerpo** del coloso ya llena el anillo 1, así
   que la onda solo alcanzaba **1 anillo** más allá de su cuerpo (casi nada).

**Solución:**
- **`isAutocentered(move)`** y **`autocenteredRadius(radius, size)`** en
  [`combat.ts`](../packages/shared/src/combat.ts) (compartidas, servidor+cliente).
- [`GameService.cast`](../services/game-service/src/services/GameService.ts): una onda
  autocentrada **ignora la casilla clicada** y se centra siempre en el lanzador (`dist 0`,
  nunca «fuera de rango»); su radio se **expande por la huella** del caster
  (`autocenteredRadius`: `large` → +1), de modo que alcanza *más allá* de su cuerpo.
- [`BoardView.buildAttackPreview`](../services/frontend/src/views/BoardView.ts): el AoE de un
  autocentrado se dibuja **siempre alrededor de la pieza** (no depende del ratón) y con el
  radio expandido, para ver qué alcanza; basta clicar para lanzarlo.
- [`botStrategy.pickCastMove`](../services/frontend/src/controllers/botStrategy.ts): la IA
  considera un autocentrado «con alcance» a un enemigo dentro de su **radio** (no solo a
  dist 0), así el bot también usa terratemblor.

**Verificación:** `moveShapes.test.ts` — autocentrado ignora el target y golpea al vecino;
el radio se expande con la huella del coloso (medium radio 2 no llega a dist 3, large sí);
radial *con* alcance (rock-slide) sigue respetando el rango. `pickCastMove` con autocentrado.
game-service **86/86**, frontend **23/23**, `tsc` limpio en los 3 workspaces.

## TA.4 — Tutor de movimientos *(diferido — futuro)*
