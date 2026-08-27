# VISUAL_FEEDBACK.md — Primitivas de feedback visual (números flotantes, flash, tween)

> Implementado en el ticket **T0.4** (Épica 0 · Fundaciones) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Documenta las primitivas de feedback
> visual del cliente y el consumo del canal de eventos ([T0.1](15-TURN_EVENTS.md)).
> Vigente desde 2026-07-12.

## Por qué existe

El servidor ya emitía eventos estructurados por acción (`state.events: TurnEvent[]`,
[T0.1](15-TURN_EVENTS.md)), pero **nadie los consumía**: el cliente solo tenía el log de
texto lateral y un `transition` CSS de 0.1s en los sprites. No había forma de "ver" el
daño, las curaciones, los revelados ni los desplazamientos.

T0.4 crea las **primitivas reutilizables** de feedback (número flotante, flash/"!", tween)
y **cablea el primer consumidor** (`damage` → número rojo). Es la fundación visual de la
que cuelgan T1.2 (flash de revelado), T2.3 (números daño/curación), T3.2/T3.4
(deslizamientos), T4.4 (intercepción) y T8.5 (captura): cada uno solo añade su `case` en
el dispatch y/o llama a estas primitivas.

## Capa DOM `#fx-layer`

[`services/frontend/index.html`](../services/frontend/index.html): un `div#fx-layer`
(`absolute inset-0 pointer-events-none z-30`) **justo después** de `#entities-layer`.

- **Por qué una capa aparte:** el bucle de limpieza de `EntityView`
  ([`EntityView.ts`](../services/frontend/src/views/EntityView.ts)) elimina todo hijo de
  `#entities-layer` cuyo id no corresponda a un ocupante actual. Un número flotante ahí se
  borraría en el siguiente render. `#fx-layer` es independiente.
- **Apilamiento:** al ir después en el DOM con `z-30` (mismo contexto que los sprites),
  pinta **por encima** de ellos y **por debajo** del HUD (`z-40`/`z-50`).

## `hexToScreen` (fuente única de posición)

[`BoardView.ts`](../services/frontend/src/views/BoardView.ts) expone
`hexToScreen(hex): {x, y}` = `hexToPixel` + offset de cámara + zoom alrededor del centro.
Antes esa transformación estaba **duplicada inline** en `EntityView`; ahora `EntityView` y
`FxLayer` comparten el mismo método (una sola fuente de verdad para colocar sprites y FX).

## Primitivas — `FxLayer` (`services/frontend/src/utils/fx.ts`)

Clase construida con `(state, boardView)` que gestiona `#fx-layer`. Todas las animaciones
usan la **Web Animations API** (`el.animate`) y cada nodo se **auto-elimina** al terminar;
no hay CSS global ni keyframes en Tailwind.

- **`floatingNumber(hex, text, 'damage' | 'heal')`** — número posicionado en
  `hexToScreen(hex)`, fuente `Press Start 2P`, rojo `#ff5252` (daño) / verde `#5dfc7a`
  (curación), con **contorno negro nítido de 8 direcciones** (constante `OUTLINE`,
  `text-shadow` de 2px en 8 offsets — recorta limpio sobre cualquier fondo; se descartó
  `-webkit-text-stroke` por emborronar el glifo). Animación ~**1.5s**: entra subiendo,
  **se mantiene visible** (opacidad plena hasta el 70%) y se desvanece al final.
- **`flash(hex, text = '!')`** — destello "!" amarillo (`#fde047`, mismo `OUTLINE`) que
  escala `0.6→1.4` y se desvanece (~450ms). Para el revelado de emboscada (T1.2).
- **`tween(el, fromHex, toHex, ms = 250): Promise<void>`** — anima `left/top` de un
  elemento existente entre dos hexes; resuelve al acabar. Primitiva para el deslizamiento
  de knockback/dash; su integración con el ciclo de vida de los sprites de `EntityView`
  es de T3.2/T3.4.

> Los nodos se posicionan al crearse; si el jugador hace pan/zoom durante la animación
> (~1s) no siguen a la cámara. Son transitorios: aceptable.

## Consumo de eventos — `GameController.dispatchEvents`

[`GameController.ts`](../services/frontend/src/controllers/GameController.ts): en
`applyMatchState`, tras `setMatch(newState)`, se llama a `dispatchEvents(newState)`.

- **Carga inicial omitida:** solo se despacha si existía `oldPlayer` (había un estado
  previo), para no reproducir eventos viejos al entrar/refrescar (F5).
- **Deduplicación por firma:** `sig = turn | currentPlayer | JSON.stringify(events)`; si
  coincide con la última despachada, se salta. Necesario porque en **online** la respuesta
  HTTP de la acción **y** el eco WS difunden el **mismo** estado (`GameActionService.apply`
  hace `broadcastPersonalized` a toda la sala, incluido el actor) → sin la guarda, cada
  número saldría **doble**.
- **Dispatch:** `switch(ev.kind)`; T0.4 solo cablea **`damage`** →
  `fxLayer.floatingNumber(hex, String(delta), 'damage')` (delta negativo ⇒ "-N" rojo). El
  resto de `kind` (`heal`, `reveal`, `knockback`, `dash`, `capture`) los añaden sus tickets;
  la estructura ya está lista.

## Verificación

- `tsc --noEmit` limpio en `services/frontend`; tests frontend 17/17 sin regresión.
- Imagen Docker del frontend reconstruida; `make up` levanta el stack (frontend HTTP 200,
  game-service healthy).
- Smoke visual (usuario): en partida local, un ataque que daña muestra un número rojo `-N`
  con contorno sobre el objetivo, visible ~1.5s; sin duplicados; sin números al recargar.

## Pendiente / cómo se extiende

- **T2.3:** añadir el `case 'heal'` (verde) y cubrir daño/curación de fin de turno.
- **T1.2:** `case 'reveal'` → `flash(hex)`.
- **T3.2/T3.4:** `case 'knockback'`/`'dash'` → `tween` del sprite (requiere coordinar con
  el reposicionado de `EntityView`).
- **T8.5:** `case 'capture'` → animación/`flash` + marca 🎯 (ya existe en inventario).
