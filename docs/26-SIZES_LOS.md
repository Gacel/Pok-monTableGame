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

## T4.2 — Render de Pokémon Large (frontend) *(pendiente)*

## T4.3 — Línea de visión + bodyblocking (backend) *(pendiente)*

## T4.4 — Feedback de intercepción (frontend) *(pendiente)*
