# FRONTEND_ARCHITECTURE.md — Arquitectura del cliente (más allá del menú)

> [`05-FRONTEND_MENU.md`](05-FRONTEND_MENU.md) documenta el árbol de navegación del
> hub (menús, `main.ts` como router). Este documento cubre lo que queda: el mundo
> "tablero" (render del juego), la capa de red, el estado de sesión y la IA local.
> Complementa a [`services/game-service/README.md`](../services/game-service/README.md)
> (equivalente en el backend). Vigente a 2026-07-11.

## 1. Dos mundos, dos estilos de MVC

El frontend (`services/frontend/`, Vite + TS + Tailwind, sin framework) tiene dos
zonas con disciplinas distintas, ya señaladas en
[`archive/ARCHITECTURE_AUDIT.md`](archive/ARCHITECTURE_AUDIT.md):

- **Mundo "tablero"** (`controllers/GameController.ts`, `models/GameState.ts`,
  `views/{BoardView,EntityView,HUDView,MinimapView}.ts`): MVC razonable — el
  estado fluye servidor → `GameState` (store observable) → vistas. `GameState`
  nunca calcula reglas de juego, solo refleja lo que dice el servidor.
- **Mundo "hub"** (`views/hub/*`, `main.ts`): router imperativo con estado
  repartido entre módulos y el DOM; ver [`05-FRONTEND_MENU.md`](05-FRONTEND_MENU.md).

## 2. `models/` — estado

- **`Types.ts`**: ya no duplica tipos a mano — re-exporta `@transcendence/shared`
  (`Hex`, `Biome`, `PokemonType`, `Pokemon`, `Tile`, `MatchState`, `MoveOptions`,
  etc.). Cualquier tipo de dominio nuevo se añade en `packages/shared`, no aquí.
- **`GameState.ts`**: store observable (patrón listener/notify) con el
  `MatchState` autoritativo, opciones de movimiento, hex seleccionado, cámara y
  zoom. Expone helpers de consulta (`isMoveTarget`, `isAttackTarget`) que las
  vistas usan para pintar, sin decidir legalidad por su cuenta.

## 3. `controllers/` — orquestación de la partida

- **`GameController.ts`** (~31 KB, el fichero más grande del frontend): conecta
  red (REST + WSS), input de usuario, cámara y las 4 vistas del tablero. Arranca
  `WsClient`, aplica los estados difundidos a `GameState`, gestiona turnos y el
  ciclo draft → partida → combate → resultado. Es un God object reconocido en la
  auditoría (hallazgo #1, backend `controllers/GameController.ts` en el audit es
  otro archivo — aquí es el equivalente frontend) — la descomposición en
  Controller + CameraController + InputController + `GameApi` está **diferida**
  (ver [`archive/REFACTOR_PLAN.md`](archive/REFACTOR_PLAN.md) fase 7).
- **`botStrategy.ts`**: IA del bot para partida local (sin red, sin DOM — lógica
  pura y testeable, `test/botStrategy.test.ts`). 3 niveles: FÁCIL (casi
  aleatorio), NORMAL (codicioso: mejor ataque disponible o acercarse), DIFÍCIL
  (prioriza remates/súper-efectivos, evita combates desfavorables, se posiciona
  por ventaja de tipo).
- **`aiDraft.ts`**: selección de equipo de la IA en el draft (partida 1 jugador),
  también pura y testeada (`test/aiDraft.test.ts`). FÁCIL aleatorio, NORMAL mejores
  stats, DIFÍCIL contrapica por tipo al equipo ya elegido por el humano.

## 4. `net/` — capa de red

- **`api.ts`**: `apiFetch()`, wrapper de `fetch` con `credentials: 'include'` para
  que la cookie `HttpOnly` de sesión viaje sola; ya no hay JWT manejado desde JS
  (ver [`08-AUTH.md`](08-AUTH.md)).
- **`WsClient.ts`**: cliente WSS con reconexión automática a la misma sala.
  Recibe difusiones autoritativas (`state`, `room`, `chat`) del `game-service` y
  se las entrega al `GameController`; los movimientos siempre se envían por REST
  (que a su vez difunde por WSS), nunca directamente por WS desde el cliente.
- **`AuctionApi.ts`**: llamadas REST específicas de la casa de subastas (ver
  [`09-AUCTIONS.md`](09-AUCTIONS.md)). Es el único dominio con su propio `*Api.ts`
  hoy — extraer el resto de vistas del hub a `net/*Api.ts` equivalentes está
  **diferido** (fase 5b de `archive/REFACTOR_PLAN.md`).
- **`PokeSprites.ts`**: única implementación de carga de sprites PokeAPI (antes
  duplicada en 6 sitios), con caché en memoria. Llama a pokeapi.co directamente;
  enrutarlo por un `pokeapi-proxy` interno con Redis es trabajo futuro — ese
  servicio no existe todavía (ver [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md)).

## 5. `state/` y `auth/` — sesión

- **`state/MatchSession.ts`**: persiste en `sessionStorage` la sesión de partida
  online (`matchId`, slot propio, nombres por slot) para poder reconectar tras
  un F5 a la misma sala y slot.
- **`auth/AuthState.ts`**: estado de sesión de usuario en el cliente (login,
  2FA, datos públicos del propio usuario vía `/api/users/me`). No guarda el JWT;
  la sesión vive en la cookie `HttpOnly`.

## 6. `utils/` — utilidades compartidas por las vistas

- **`html.ts`**: `escapeHtml`/`escapeAttr`, única implementación de escapado
  antes de interpolar en `innerHTML` (antes había 4 versiones divergentes, una
  de ellas vulnerable — ver el hallazgo #5 en
  [`archive/SECURITY_AUDIT.md`](archive/SECURITY_AUDIT.md)).
- **`trainer.ts`**: `spriteOf`/`trainerSpriteUrl`, saneado del `avatarUrl` del
  usuario a un charset seguro antes de usarlo en un `src` de `<img>` (corrige el
  XSS almacenado del hallazgo #1 de la misma auditoría).
- **`theme.ts`**: paleta de colores por jugador (`PLAYER_COLORS`), única fuente
  (antes duplicada con matices distintos en `CombatView`, `HUDView`,
  `MinimapView`, `EntityView`, `DraftView`).
- **`audio.ts`**: efectos de sonido simples (click).

## 7. `views/` (tablero, fuera del hub)

- **`BoardView.ts`**: render en `<canvas>` del tablero hexagonal — proyección
  axial→píxel, texturas por bioma, resaltado de movimientos/ataques/AoE
  (`calculateAoE` de `@transcendence/shared`).
- **`EntityView.ts`**: capa DOM superpuesta al canvas para las piezas/Pokémon
  (sprites posicionados sobre la proyección de `BoardView`).
- **`HUDView.ts`**: banner de turno, barras de HP, panel de recursos, log de
  eventos, toasts y overlay de resultado.
- **`MinimapView.ts`**: minimapa a escala reducida reutilizando la proyección de
  `BoardView`; resalta el viewport visible y permite navegar con clic. La niebla
  (fog) y el ocultamiento de enemigos fuera de vista son **solo visuales en el
  cliente** — el servidor no filtra hoy la visibilidad por hex antes de enviar el
  estado (ver la nota de "Minimap/fog" en
  [`11-GAME_DESIGN_ROADMAP.md`](11-GAME_DESIGN_ROADMAP.md)).

## 8. Deuda conocida (no bloqueante)

Ver [`archive/ARCHITECTURE_AUDIT.md`](archive/ARCHITECTURE_AUDIT.md) para el
detalle completo con severidades. Resumen de lo **diferido** (no arreglado):
`GameController` sigue siendo un God object; `views/hub/*` siguen mezclando
lógica de negocio y llamadas de red directas salvo subastas; el estado sigue
repartido entre el store del tablero y el DOM del hub; `main.ts` sigue siendo un
router imperativo con acoplamiento circular hacia las vistas.
