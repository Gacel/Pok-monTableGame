# LOCAL_PRESENTATION.md — Ocultación local, control de turno vs-IA, cámara y presentación

> Implementado en los tickets **T1.3** (ocultación en local) y **T1.4** (presentación y
> control) del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md), surgidos al probar
> el terreno de [`19-TERRAIN_MAP.md`](19-TERRAIN_MAP.md). Vigente desde 2026-07-13.

## Por qué existe

Al haber ya hierba alta en el mapa, se hicieron visibles varios problemas de presentación
y control en partidas **locales** (hot-seat y vs-IA):

- Se veían translúcidos los Pokémon **ocultos del rival** (en vs-IA no debería).
- El humano podía **actuar y pasar turno** durante el turno de la IA.
- La cámara solo se movía arrastrando; sin teclado.
- Al mover la cámara los sprites "bailaban"; los nombres mostraban `player1`/`player2`.

## T1.3 — Ocultación desde la perspectiva del humano (local)

El servidor censura los ocultos enemigos solo si `getStateDTO(requestingPlayerId)` recibe
un jugador (online). En **local** el estado va sin censurar → el cliente los pintaba
translúcidos. Solución **en cliente** (el flag `isHidden` ya llega):

- [`GameState`](../services/frontend/src/models/GameState.ts): `hiddenAllySlots: string[] |
  null`. `null` = sin ocultación en cliente (online —server censura— o hot-seat —pantalla
  compartida—). En vs-IA = slots del **equipo humano**.
- [`GameController.updateStealthPerspective`](../services/frontend/src/controllers/GameController.ts):
  lo calcula en `applyMatchState` (humanos = `players` sin bot; aliados por `alliances`).
- [`EntityView`](../services/frontend/src/views/EntityView.ts) y
  [`MinimapView`](../services/frontend/src/views/MinimapView.ts): un oculto de un slot
  fuera de `hiddenAllySlots` **no se renderiza** (ni en tablero ni en minimapa). Los
  ocultos que sí se muestran (los míos en vs-IA, ambos en hot-seat) van **translúcidos**
  (opacidad 0.4 en tablero, `globalAlpha 0.45` en minimapa) como indicador de emboscada.

**Decisión (con el usuario):** hot-seat muestra todo (pantalla compartida); vs-IA oculta
al enemigo; online sin cambios.

## T1.4 — Presentación y control (local)

### Control de turno vs-IA
`isMyTurn()` en local devolvía `true` siempre → el humano actuaba en el turno de la IA.
Ahora en local devuelve `!isBotSlot(currentPlayer)`: el humano no puede seleccionar/mover/
atacar (gate de `handleCanvasClick`) ni pasar turno durante el turno de la IA, y el **botón
FINALIZAR TURNO se oculta** (`updateTurnControls` usa `isMyTurn`). El **bot pasa su propio
turno** con `endTurn(fromBot=true)`, que salta el guard. Hot-seat y online sin cambios.

### Nombres de jugador / IA
La etiqueta sobre el Pokémon mostraba el slot crudo (`player1`). Ahora usa
`GameState.labelFor(playerId)` (username / "Jugador N"). Los slots de IA se **bautizan** en
`setBots`: `playerNames[slot] = "IA"` (o "IA 2/3…" en FFA), en vez de "Jugador 2".

### Cámara con teclado (WASD + flechas)
Paneo suave con bucle `requestAnimationFrame` mientras se mantienen teclas
(`panKeys`/`startPanLoop`/`panStep`), varias direcciones a la vez, primer paso inmediato y
velocidad **constante en pantalla** (`step / zoom`). Las **flechas** siempre panean; **WASD
solo si NO hay pieza seleccionada** (con pieza, Q/W/E/R son los hotkeys de movimiento, así
que WASD se inhabilita como bloque, coherente). Se libera al soltar/perder foco.

### Sprites estáticos al mover cámara (no "bailan")
El baile venía de la `transition` CSS de `left/top` (0.1s) de los sprites: el canvas se
movía al instante y los sprites con retardo. `GameState.cameraMoving` marca cuándo la
cámara se mueve (paneo teclado, arrastre de ratón o centrado animado); mientras es `true`,
`EntityView` reposiciona los sprites **sin transición** de `left/top` (quedan clavados al
mapa) y la conserva en reposo para que los movimientos hex→hex sigan deslizándose.

### Medio sumergido en agua
En loseta `WATER` el sprite muestra solo los **2/3 superiores** (máscara con degradado en
la línea de flotación), se **hunde** ~0.24× (recentrado en la loseta), se **oculta el
óvalo/base** y se dibuja una **línea de flotación** celeste/blanca (`wl-…`) donde el agua
toca el cuerpo. Todo en `EntityView`, respetando el paneo y el `cleanup` de la capa.

### Zoom en despliegue
El zoom con rueda se bloqueaba en cualquier estado `!== 'active'` (incluido **deployment**).
Ahora solo se bloquea en `finished` (overlay de victoria); en despliegue y juego funciona.

## Verificación

- `tsc` limpio (frontend); tests frontend 17/17, game-service 36/36; stack Docker sano.
- Smoke visual (usuario, vs-IA y hot-seat): ocultos del enemigo invisibles y los propios
  translúcidos (tablero + minimapa); sin poder actuar ni ver el botón en el turno de la IA;
  cámara ágil con WASD/flechas/arrastre sin baile; agua con medio-sumergido y línea de
  flotación; nombres correctos (tú / "IA"); zoom en despliegue.
