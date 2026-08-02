# 28 · Fix de la IA — ataques on-map y partida sin congelarse (FIX-IA)

> Corrige que la IA (partida local vs bot) hiciera **movimientos ilegales** y **congelara**
> la partida al no poder avanzar el turno. Alinea la IA con el combate on-map por rango
> (`/cast`) introducido en la **Épica A**.

## Síntoma

El bot decidía atacar, la partida se quedaba parada en su turno y no avanzaba. En consola,
jugadas rechazadas ("No cabe en esa casilla" / casilla ocupada).

## Causa raíz

El combate dejó de ser melee-adyacente y pasó a ser **on-map por rango** (`POST /cast` con
`{from, target, moveIndex}`, Épica A). Pero la ejecución de la IA nunca se actualizó:

- `runBotTurn` (`GameController`) enrutaba **toda** decisión que no fuese `end` por
  `performMove(from, to)`. Cuando la decisión era `type:'attack'`, `to` es la casilla del
  **enemigo** → mover ahí es ilegal → el servidor responde error.
- `performMove`/`performCast` no devolvían resultado: ante el rechazo mostraban un toast pero
  **no** llamaban a `applyMatchState`. Y como el bucle del bot solo continúa cuando se aplica
  estado nuevo (`applyMatchState → maybeRunBot`), un rechazo dejaba el turno **congelado**.

Además, la heurística del bot (`decideBotAction`) razona por **adyacencia** (modelo melee
heredado): sus objetivos de ataque son enemigos adyacentes al área alcanzable, no
necesariamente dentro del **alcance real** del ataque desde su posición.

## Solución

Todo en el frontend (la IA local vive en el cliente; el servidor ya validaba correctamente).

### 1. `performMove` / `performCast` → `Promise<boolean>`

Devuelven `true` solo cuando la jugada se aplicó (`applyMatchState` corrió) y `false` en
rechazo o error de red. Así quien llama sabe si la acción prosperó.

### 2. `runBotTurn` — enrutado correcto + garantía de avance

- `type:'attack'` → **`botCast(from, to)`** (nunca `/move`).
- Si `botCast` falla porque el objetivo está fuera del alcance real, la pieza **se acerca**:
  `performMove` al hex alcanzable que minimiza la distancia al objetivo
  (`closestStepToward`), para poder atacar el próximo turno.
- Si **nada** prospera (acción rechazada), `endTurn(true)`: **la partida siempre avanza**,
  nunca se congela.

### 3. `botCast` + `pickCastMove` (lógica pura, testeable)

`botCast` obtiene los moves del atacante y delega en `pickCastMove(moves, dist)`
(`botStrategy.ts`), que elige el **índice del move de mayor potencia cuyo alcance llega** al
objetivo:

- `aoe:'radius'` (onda autocentrada): alcanza si `dist <= range` (incluye `dist 0`).
- resto (melee/proyectil/línea): alcanza si `1 <= dist <= range`.
- `-1` si ninguno llega → `botCast` devuelve `false` y `runBotTurn` intenta acercarse.

## Archivos tocados

- `services/frontend/src/controllers/GameController.ts`
  — `performMove`/`performCast` → `boolean`; `runBotTurn` enruta ataques por `botCast` con
  fallback de acercamiento y `endTurn` garantizado; nuevos `botCast` y `closestStepToward`.
- `services/frontend/src/controllers/botStrategy.ts`
  — nueva función pura exportada `pickCastMove(moves, dist)`.
- `services/frontend/test/botStrategy.test.ts`
  — 5 casos de `pickCastMove` (elige por potencia+alcance; fuera de rango → −1; melee no
  llega a dist 2; radial autocentrado desde dist 0; sin moves → −1).

## Verificación

- `tsc --noEmit -p services/frontend/tsconfig.json` limpio.
- `npm --workspace services/frontend test` → **22/22** (17 previos + 5 nuevos).
- `npm run build` (frontend) OK; `docker compose up -d --build frontend` levanta el
  contenedor; stack acumulado sigue en pie.
- Smoke en partida vs IA: el bot lanza ataques dentro de rango, se acerca cuando el objetivo
  está lejos y **el turno avanza siempre** (sin congelarse).

## Notas / seguimiento

- La heurística del bot sigue razonando por adyacencia; el enrutado por rango + acercamiento
  la hace jugable y correcta, pero un rediseño de `decideBotAction` para puntuar objetivos por
  **alcance de cast** (en vez de adyacencia) mejoraría la agresividad. Follow-up opcional.
