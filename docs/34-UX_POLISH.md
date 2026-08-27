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
