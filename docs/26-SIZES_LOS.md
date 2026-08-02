# SIZES_LOS.md — Tamaños, render de grandes, línea de visión y bodyblocking (Épica 4)

> Documento de la **Épica 4** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> tamaño por especie, render de los grandes, y línea de visión / bloqueo por colosos. Se
> extiende ticket a ticket. Vigente desde 2026-07-14.

## T4.1 — Tamaño por especie (backend)

**Qué:** cada especie tiene su tamaño real (`small`/`medium`/`large`) en vez del `medium`
hardcodeado. Un `large` ocupa **7 hexes** (`getOccupiedHexes`) y no puede escalar montañas
(`canEnter`); `small` es de momento visual.

**Cómo** ([`engine/sizes.ts`](../services/game-service/src/engine/sizes.ts)): mapa curado
`sizeForSpecies(name)` con conjuntos `LARGE`/`SMALL` de Gen 1 (por decisión D6 se usa un
mapa curado en vez de umbrales height/weight, que misclasifican casos como Onix —alto y
fino— o Snorlax —bajo y enorme—). `PokemonService.getTemplate` lo aplica al crear el
template **y también sobre el cacheado** (los guardados antes de esta mecánica eran
`medium`), así que surte efecto sin resetear la BD ni tocar el esquema. `MatchManager.build`/
`buildPokemon` ya propagan `size` (spread del template).

**Verificación:** [`test/sizes.test.ts`](../services/game-service/test/sizes.test.ts) —
grandes/pequeños clásicos y `medium` por defecto, insensible a mayúsculas. game-service 68/68.

## T4.2 — Render de Pokémon Large (frontend)

**Qué:** los grandes se ven claramente mayores y su huella (7 hexes) está resaltada.

**Cómo:**
- [`EntityView`](../services/frontend/src/views/EntityView.ts): un `large` ocupa 7 hexes, así
  que se agrupa por id y se **dibuja una sola vez en el centro** (centroide de sus casillas),
  no una por casilla (antes la última loseta ganaba y lo descolocaba). El sprite se escala por
  tamaño: `large` ×2, `small` ×0.75, resto ×1.
- [`BoardView`](../services/frontend/src/views/BoardView.ts): cada casilla ocupada por un
  `large` recibe un **resaltado de huella** ámbar tenue.

**Verificación:** `tsc` frontend limpio, tests 17/17. Smoke: un Snorlax/Onix se ve grande y
sus 7 casillas resaltadas.

## T4.3 — Línea de visión + bodyblocking (backend)

**Qué:** un `large` enemigo interpuesto entre el atacante y el objetivo **intercepta** el
impacto (lo recibe él; lo de detrás queda a la sombra). Vale para línea, cono y ondas
radiales (LoS por hex del AoE) — D3.

**Cómo** ([`GameService`](../services/game-service/src/services/GameService.ts)):
`losBlocker(from, targetHex, targetId, caster)` traza `hexLineDraw(from, targetHex)` y busca
en los hexes **intermedios** (excluye origen y objetivo) un `large` **enemigo** (los aliados
no bloquean tu propio disparo; el objetivo no se auto-bloquea). El bucle de daño de `cast`
usa `victim = blocker ?? occupant` y `victimHex` correspondiente, de modo que el coloso
recibe el daño/KO/knockback/revelado en lugar del objetivo original (dedup por id).

**Verificación:** [`test/bodyblock.test.ts`](../services/game-service/test/bodyblock.test.ts)
— coloso enemigo intercepta y el de detrás queda intacto; sin coloso el objetivo recibe;
un large aliado no bloquea. game-service 71/71.

## T4.4 — Feedback de intercepción (frontend)

**Qué:** que se vea que el proyectil impacta en el muro (coloso) y no en el objetivo.

**Cómo:** el daño de intercepción ya se emite en el hex del coloso (T4.3), así que el número
flotante aparece sobre él. Además, `TurnEvent.blocked?` (nuevo en
[`match.ts`](../packages/shared/src/match.ts)) marca el evento de daño interceptado;
[`GameController.dispatchEvents`](../services/frontend/src/controllers/GameController.ts)
reproduce un **flash de escudo 🛡️** sobre el coloso (primitiva `flash` de T0.4) junto al
número. **Cierra la Épica 4.**

**Verificación:** `tsc` limpio en los 3 workspaces, game-service 71/71. (Smoke visual
pendiente por el tooling de Docker en el entorno.)

## T4.5 — Fix de selección y movimiento de grandes

**Problemas (reportados en smoke):** (1) no se veían bien las casillas que ocupa un grande;
(2) según en qué casilla del grande clicabas salía un rango de movimiento distinto; (3)
decía "se mueve" pero no se movía si por su tamaño no cabía.

**Cómo:**
- [`engine/movement.ts`](../services/game-service/src/engine/movement.ts) `getMoveOptions`
  ahora es **consciente del tamaño**: rutea desde el **centro** (centroide del cuerpo,
  se derive de cualquier casilla clicada), trata el **cuerpo propio como transitable** (antes
  el large se bloqueaba a sí mismo) y solo ofrece destinos donde la **huella (7 hexes) cabe**.
- [`GameService.play`](../services/game-service/src/services/GameService.ts) **honra** el
  resultado de `moveOccupant`: si el grande no cabe, devuelve error en vez de mentir con
  "se mueve".
- Frontend: la selección **normaliza al centro** del ocupante
  ([`GameController.occupantCenter`](../services/frontend/src/controllers/GameController.ts)),
  y [`BoardView`](../services/frontend/src/views/BoardView.ts) resalta **toda la huella** de
  la pieza seleccionada (no solo el hex clicado).

**Verificación:** [`test/largeMovement.test.ts`](../services/game-service/test/largeMovement.test.ts)
— un large se mueve en abierto e igual se consulte por el centro o por el borde; no ofrece
destinos donde la huella no cabe; medium sin regresión. game-service 82/82.

## T4.6 — Pulido de presentación de grandes (feedback de smoke)

- **Huella con color del jugador:** las 7 casillas de un large se tiñen con el **color de su
  jugador** muy tenue (`BoardView.PLAYER_RGB`, alpha 0.16), en vez del ámbar plano, para
  leerlas sin seleccionarlo.
- **HUD sin duplicados:** el roster del HUD mapeaba `tiles → occupant` sin dedup, así que un
  large (7 casillas) salía **7 veces**; ahora se deduplica por id (`HUDView`).
- **`LARGE` recortado:** la lista de tamaños era demasiado generosa (Mewtwo, pájaros
  legendarios, Machamp, Rapidash… salían tan grandes como Snorlax). Se deja `large` solo para
  colosos reales (Snorlax, Onix, Gyarados, Lapras, Dragonite, Rhydon, Golem, Kangaskhan,
  Venusaur, Charizard, Blastoise, Arcanine, Aerodactyl, Exeggutor, Nidoking/queen); el resto,
  `medium`. *(Nota: una partida en curso conserva el tamaño con el que se creó; se aprecia al
  empezar una nueva.)*
