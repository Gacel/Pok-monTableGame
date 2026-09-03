# Pulido de UI/UX y Calidad de Vida (Épica 11)

> Documento vivo de la Épica 11: mejoras de experiencia de usuario,
> feedback visual, audio, sprites y calidad de vida.

## T11.1 — Barra de vida sobre cada Pokémon en combate

**Archivo:** `services/frontend/src/views/EntityView.ts`

Se añade un div HP bar flotante por cada pieza con ocupante visible:

- **Posición:** encima del sprite, centrado horizontalmente, justo debajo del label
  del jugador (`barY = screenY - sSize/1.1 - 6*zoom + waterSink`).
- **Tamaño:** ancho `sSize * 0.7`, alto `max(3, 4*zoom)` — escala con el zoom.
- **Color semáforo:** verde (`#22c55e`) si HP ≥ 50%, amarillo (`#eab308`) si ≥ 25%,
  rojo (`#ef4444`) si < 25%.
- **Técnica:** fondo negro semitransparente + hijo con `scaleX(hpRatio)` desde la
  izquierda, transiciones CSS de 0.2s en `transform` y `background`.
- **Niebla de guerra:** opacity 0.4 (coherente con sprite/label/base); no se renderiza
  si la pieza está completamente oculta (filtro `hiddenAllySlots`).
- **Limpieza:** el prefijo `hp-` se añade al regex de limpieza de nodos huérfanos.

## T11.2 — Cámara sigue al Pokémon activo (turno rival)

**Archivos:** `services/frontend/src/controllers/GameController.ts`

- En `dispatchEvents`, eventos `knockback`/`dash` llaman a `centerOnTile` en el hex
  del evento si no es el turno local (`!isMyTurn()`) y no hay paneo manual activo
  (`panKeys.size === 0`).
- En `applyMatchState`, el centrado por cambio de turno (rama no-deployment) se
  condiciona a `panKeys.size === 0` para no interrumpir paneo con teclado.

## T11.3 — Audio de combate (hit + death)

**Archivos:** `services/frontend/src/utils/CombatAudio.ts`,
`services/frontend/src/controllers/GameController.ts`

- `CombatAudio.ts`: singleton con `playHit()` (ruido blanco filtrado, 0.15s) y
  `playDeath()` (oscilador square descendente 440→80 Hz + ruido lowpass, 0.7s).
- `dispatchEvents` calcula `inFog` por evento (ocupante oculto de slot enemigo);
  solo reproduce audio si `!inFog`.

## T11.4 — Draft / picker con sprites shiny

**Archivo:** `services/frontend/src/views/hub/OwnedTeamPickerView.ts`

- Interfaz `OwnedPokemon` extendida con `isShiny?: boolean`.
- Método `spriteKey(p)` retorna `name-shiny` para shinies (clave de caché separada
  en PokeSprites).
- Las cartas del picker muestran `✨` delante del nombre si `isShiny`.

## T11.5 — Ocultar objetos con qty 0

**Archivo:** `services/frontend/src/views/hub/InventoryView.ts`

- `visibleItems = items.filter(it => it.qty > 0)` antes de renderizar.
- El panel del entrenador usa `visibleItems.length` para el conteo.

## T11.6 — Animación de evolución

**Archivos:** `services/frontend/src/utils/EvolutionFx.ts`,
`services/frontend/src/controllers/GameController.ts`,
`services/frontend/src/views/hub/PokemonDetailModal.ts`

- `EvolutionFx.ts`: `playEvolutionFx(parent, x, y, newName?)` con 3 fases
  (halo 0–0.5s, 12 estrellas en espiral 0.5–1.5s, flash + label 1.5–2.5s).
- En `GameController.dispatchEvents` (`case 'evolve'`): reemplazado flash por
  `playEvolutionFx` sobre fx-layer.
- En `PokemonDetailModal.doEvolve`: reemplazado `alert()` por animación sobre
  el `pkmn-modal-card`.

## T11.7 — Comprar varias piedras

**Archivos:** `services/frontend/src/views/hub/ShopMenuView.ts`,
`services/game-service/src/controllers/ShopController.ts`,
`services/game-service/src/routes/shop.routes.ts`,
`services/game-service/test/stones.test.ts`

- Frontend: cartas de piedra con selector de cantidad (+/− botones), botón
  COMPRAR separado.
- Backend: `qty` en body validado [1,10]; `totalPrice = stone.price * qty`;
  `ItemModel.add` con qty.
- Test: verificación de acumulación `qty=3 + qty=5 → 8`.

## T11.8 — Panel entrenador compacto

**Archivo:** `services/frontend/src/views/hub/InventoryView.ts`

- Ancho reducido de `md:w-1/3` → `md:w-56 flex-shrink-0`.
- Min-height de `min(50vh, 320px)` → `min(30vh, 200px)`.
- Font sizes y sprite clamp reducidos.

## T11.9 — Selector y confirmación recuperar Pokémon

**Archivos:** `services/frontend/src/views/hub/ShopMenuView.ts`,
`services/game-service/src/controllers/ShopController.ts`,
`services/game-service/src/routes/shop.routes.ts`,
`services/game-service/src/models/OwnedPokemonModel.ts`

- Frontend: `recoverPokemon()` fetch `GET /api/shop/lost-pokemon`, muestra
  `showLostPicker` con cartas de sprites, confirmación modal antes de
  `doRecover(id)`.
- Backend: `listLostPokemon` handler; `recoverPokemon` acepta `{ id }`;
  `OwnedPokemonModel.listLost` y `recoverById`.

## T11.10 — Skip animación gacha

**Archivo:** `services/frontend/src/views/hub/ShopMenuView.ts`

- `gachaTimers: number[]` almacena todos los `setTimeout` de la animación.
- `attachGachaSkip()` renderiza un botón SKIP (dos-pasos: visible → skip).
- `skipToReveal()` limpia timers/audio/DOM y salta al reveal.

## T11.11 — Mensaje pokéball menciona shiny

**Archivo:** `services/frontend/src/views/hub/ShopMenuView.ts`

- Texto de descripción de la pokéball actualizado para incluir "shiny".

## T11.12 — Moves en español en ficha modal

**Archivos:** `services/game-service/src/services/PokemonService.ts`,
`services/game-service/src/models/db.ts`

- `hydrateMove` re-hidrata si `shortEffect === null`; prioriza `language.name === 'es'`
  con fallback a `'en'`.
- Migración en `db.ts`: resetea `short_effect` cacheados en inglés a NULL
  (heurística `LIKE '%the target%' OR LIKE "%user's%"`).

## T11.13 — Botón volver en draft

**Archivos:** `services/frontend/src/views/hub/DraftView.ts`,
`services/frontend/src/main.ts`

- `DraftConfig` extendido con `onBack?: () => void` en ambas variantes.
- `draw()` renderiza botón `#draft-back` condicional; click invoca `this.config.onBack?.()`.
- `main.ts`: `showSinglePlayerDraft` pasa `onBack` que oculta el draft y restaura
  el menú single-player.

## T11.14 — Bug: abandonar Arena → partida local muestra el mapa de Arena

**Archivos:** `services/frontend/src/controllers/GameController.ts`,
`services/frontend/src/main.ts`, `services/frontend/src/models/GameState.ts`

- `abandonGame`: eliminada la llamada a `applyMatchState` — las recompensas se extraen
  sin pintar el mapa de arena en el canvas.
- Handler `return-to-menu`: añadido `MatchSession.clear()` al principio para limpiar
  la sesión de `sessionStorage`.
- `GameState.clearMatch()`: resetea `_match`, selección, moves, hover y sliding ids.
- `GameController.resetBoard()`: método público que limpia estado y repinta vacío.
- `enterGame`: al reutilizar el controller, llama `resetBoard()` antes de la nueva sesión.
- `scheduleLocalForceStart`: verificado que la guarda `this.match === target` impide
  que un timer de arena dispare sobre una partida local nueva.
