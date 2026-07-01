# AUTONOMOUS_SESSION.md — Registro de trabajo autónomo

> Diario de la sesión de trabajo autónomo (sin intervención humana) solicitada el
> **2026-07-01**. Objetivo: revisar y mejorar el proyecto siguiendo la
> especificación técnica, aplicando **MVC**, **SQLite3**, y mejorando la
> **experiencia de usuario**. Cada feature = commit + push + documentación.

## Contexto y restricciones detectadas

- **Node/npm NO instalados en el host.** Toda verificación (typecheck/tests/build)
  se realiza vía **Docker** (`node:20-alpine`). Docker v29 disponible.
- **Rama de trabajo:** `feat/overnight-improvements` (para no tocar `main` sin
  supervisión; revisable por diff/PR a la mañana siguiente).
- **Acceso push:** OK (SSH a `github.com:Gacel/Pok-monTableGame`).
- `main` local iba 2 commits por delante de `origin` al empezar; la rama parte de ahí.

## Diagnóstico inicial

1. **Bug de routing Nginx:** `/api/auth` y `/api/users` apuntaban a `hello`, pero
   esas rutas viven en `game-service` → auth rota a través del gateway.
2. **Motor puro desconectado:** `move` usaba `board.moveOccupant` sin validar
   patrones, sin turnos, sin combate. `engine/movement.ts` y `resources.ts` existían
   pero no se usaban en el servidor.
3. **`server.ts` monolítico:** mezclaba auth + users + juego → sin separación MVC.
4. **Sin combate, sin modificadores ambientales, sin economía por turnos** conectados.
5. **Sin WebSockets** (el spec los exige para tiempo real).
6. **Tipado laxo** en frontend (`occupant: any`).
7. **Tests:** `mapLoader.test.ts` tenía 1 test rojo preexistente (mapeo de bioma).

## Metodología de verificación

- Typecheck: `docker run node:20-alpine … npx tsc --noEmit` sobre el repo montado.
- Tests: copia del servicio a fs Linux del contenedor + `vitest run` (evita un bug
  de `vitest` con nombres de fichero hasheados sobre el filesystem de Windows).

---

## Registro por feature

### F1 — Documentación base ✅
- **Qué:** `docs/ARCHITECTURE.md` (faltaba según `CLAUDE.md §4`), este diario, y
  aclaración del patrón MVC en ambas capas.
- **Por qué:** dar contexto y trazabilidad al trabajo autónomo.
- **Verificación:** N/A (documentación).
- **Commit:** `docs: add ARCHITECTURE.md and autonomous session journal`

### F1.5 — ⚠️ Incidente de seguridad: API Key commiteada ✅
- **Qué se encontró:** el archivo `.agents/mcp.json` contenía una **Google API Key**
  (`X-Goog-Api-Key` del MCP `stitch`), introducida en el commit `a4d8aac` (previo a
  esta sesión, **sin publicar** — GitHub push protection bloqueó el push, así que la
  clave nunca llegó a subirse al remoto).
- **Cómo se resolvió (sin reescribir historial ya publicado):**
  1. Se reconstruyó la rama desde el último commit publicado (`490123a`, limpio).
  2. Se re-aplicó el trabajo previo del usuario vía `cherry-pick`, **omitiendo el
     archivo con el secreto** del commit, preservando su mensaje/autoría.
  3. `.agents/mcp.json` se dejó de trackear y se gitignoró; se añadió
     `.agents/mcp.json.example` con placeholder `${STITCH_API_KEY}`.
  4. El archivo local se conserva intacto (la herramienta del usuario sigue funcionando).
- **🔴 ACCIÓN REQUERIDA POR EL USUARIO:** aunque la clave no se publicó, **rótala/
  revócala** por precaución en la consola de Google Cloud. Considera cargarla como
  variable de entorno (`STITCH_API_KEY`) en lugar de en el JSON.
- **Nota:** tu rama `main` local sigue conteniendo `a4d8aac` con el secreto. Si vas a
  publicar `main`, purga ese commit o parte de `feat/overnight-improvements`.
- **Commit:** `security: stop tracking .agents/mcp.json (contained API key)`

### F2 — Fix routing Nginx ✅
- **Qué:** `/api/auth`, `/api/users`, `/api/poke`, `/ws` reenrutados a `game-service`.
- **Por qué:** apuntaban a `hello` → auth rota vía gateway (404).
- **Commit:** `fix(gateway): route /api/auth and /api/users to game-service`

### F3a — Motor de combate y entorno (lógica pura + tests) ✅
- **Qué:**
  - `engine/environment.ts`: ventaja de tipo (FIRE>GRASS>WATER>FIRE), terreno FIRE
    (+20% ATK fuego, −15% DEF planta), río WATER bloquea a FIRE (`canEnter`).
  - `engine/combat.ts`: combate por turnos determinista (`computeDamage`,
    `resolveCombat`) con log; no muta las entradas.
  - `engine/movement.ts`: nuevo `getMoveOptions` que separa **movimientos** (casilla
    vacía, respetando terreno) de **ataques** (enemigo alcanzable). `getLegalMoves`
    se mantiene por compatibilidad.
  - `board.ts`: `Pokemon` extendido con `atk/def/level`.
  - Se corrigieron los tests preexistentes (`engine.test.ts` faltaban `hp/maxHp`;
    `mapLoader.test.ts` usaba un mapeo de bioma incorrecto vs. el loader).
- **Verificación:** `vitest` → **18/18 tests OK** (incluye 12 nuevos de combate/entorno).
- **Commit:** `feat(engine): deterministic combat + environment modifiers + attack moves`

### F3b — Refactor backend a MVC + reglas autoritativas ✅
- **Qué:** se descompuso el monolito `server.ts` en capas MVC limpias:
  - **Modelos** (`src/models/`): `db.ts` (conexión + migraciones: `pokemons`,
    `users`, `matches`, `match_state`), `UserModel`, `PokemonModel`, `MatchModel`.
  - **Servicios** (`src/services/`): `PokemonService` (caché-primero DB→PokeAPI),
    `GameService` (partida autoritativa: turnos, validación, combate, recursos,
    condición de victoria, serialización), `MatchManager` (ciclo de vida + persistencia).
  - **Controladores** (`src/controllers/`): `Auth`, `User`, `Game` (finos, validan input).
  - **Rutas** (`src/routes/`): con esquemas de validación Fastify.
  - **`app.ts`** (build) + **`server.ts`** (boot + graceful shutdown que persiste).
  - Se eliminó `database.ts`.
- **Reglas conectadas:** el endpoint `move` ahora valida turno, propiedad de la
  pieza, y legalidad por patrón; los enemigos alcanzables inician **combate**; se
  colectan **recursos** por turno; se detecta **victoria**.
- **Verificación (Docker):** `tsc --noEmit` limpio + **smoke test real** arrancando
  el servidor: `/health` OK, estado con 2 jugadores, `moves` para (0,0) devuelve
  movimientos + ataque a (3,3), movimiento ilegal → 400, `login` persiste en SQLite.
- **Nuevos endpoints:** `GET /api/game/state`, `GET /api/game/moves?q&r`,
  `POST /api/game/reset` (además de `board` y `move` existentes).
- **Commit:** `refactor(game): MVC layers + authoritative turns/combat/resources`

### F7 — Overhaul de UX del frontend (consumo del estado autoritativo) ✅
- **Qué:**
  - **Tipado fuerte**: `Types.ts` con `Pokemon`, `Tile`, `MatchState`, `MoveOptions`
    (se elimina `occupant: any`).
  - `GameState` refleja el `MatchState` del servidor + opciones de movimiento y
    helpers `isMoveTarget/isAttackTarget`.
  - `GameController` reescrito: consume `GET /api/game/state`, resalta movimientos
    legales pidiendo `GET /api/game/moves`, **gating por turno** (solo seleccionas la
    pieza del jugador de turno), ejecuta `move`, muestra feedback de combate/errores
    (toast) y reinicia partida.
  - `BoardView`: resaltado de **movimientos** (verde) y **ataques** (rojo) + selección.
  - `HUDView`: banner de turno con color por jugador, barras de HP con color según
    vida, **panel de recursos** (🔥/💧/🌿), **log de eventos**, **overlay de victoria**
    con revancha, y toasts.
  - `index.html`: nuevos contenedores de HUD (banner, recursos, log, overlay, reset).
- **Por qué:** era el objetivo explícito "mejorar la experiencia de usuario" y alinear
  el cliente con el servidor autoritativo (turnos, combate, economía, victoria).
- **Verificación (Docker):** `tsc --noEmit` del frontend **limpio**.
- **Commit:** `feat(frontend): authoritative-state UX (turns, move hints, combat, resources)`

### F8 — Fix build Docker (.dockerignore) ✅
- **Qué:** `.dockerignore` en `frontend` y `game-service` (excluye `node_modules`,
  `dist`, `.env`). Sin ellos, `COPY . .` fallaba al copiar symlinks de `node_modules/.bin`.
- **Verificación:** `docker compose up --build` levanta el stack completo; se comprobó
  vía HTTPS que el gateway enruta a `game-service` y que PokeAPI carga (charmander).
- **Commit:** `fix(docker): add .dockerignore to frontend and game-service`

### F9 — Tests de integración de GameService ✅
- **Qué:** `test/gameService.test.ts` cubre turnos, validación (turno/propiedad/origen),
  recursos deterministas, combate con victoria y (de)serialización del estado.
- **Verificación:** `vitest` → **22/22 tests OK**; `tsc --noEmit` limpio.
- **Commit:** `test(game): GameService integration (turns, combat, resources, persistence)`

### F10 — Documentación de contrato y estado ✅
- **Qué:** `services/game-service/README.md` (contrato HTTP + arquitectura MVC + modelo
  de juego + envs), sección 11 en `LOCAL_DEV.md` (verificación por Docker sin Node), y
  actualización del roadmap del `README.md` al estado real.
- **Commit:** `docs: game-service contract README + docker-only verification + roadmap`

### F11 — WebSockets (sincronización de tablero + chat) ✅
- **Qué:** `@fastify/websocket` en `game-service`; `realtime/hub.ts` (difusión a la
  sala) y `routes/ws.routes.ts` (`/ws`). Al conectar se envía el estado; los `move`
  se **validan con el motor antes de difundir** (autoridad del servidor); soporta `chat`.
  Los `move` vía REST **también difunden** por WSS → REST y WSS quedan sincronizados.
  El gateway ya enruta `/ws` (F2) con cabeceras Upgrade.
- **Verificación (Docker):** `tsc --noEmit` limpio (con `@types/ws`), 22/22 tests, y
  **smoke test WSS real** con 2 clientes: ambos reciben el estado inicial y el difundido
  tras un movimiento validado, y el chat se propaga (`WS_SMOKE_OK`).
- **Commit:** `feat(game): WSS board sync + chat (server-authoritative broadcast)`

### F12 — Cliente WSS en el frontend (sync en vivo entre pestañas) ✅
- **Qué:** `net/WsClient.ts` (conexión + reconexión automática) integrado en
  `GameController`: al iniciar conecta a `/ws` y **aplica el estado difundido** por el
  servidor (movimientos de otro cliente, combate, chat) → dos pestañas sincronizadas.
  Los movimientos se siguen enviando por REST (que difunde por WSS).
- **Verificación (Docker):** `tsc --noEmit` del frontend limpio.
- **Commit:** `feat(frontend): live WSS state sync (WsClient)`

### F13 — Verificación de integración end-to-end ✅
- **Qué:** `docker compose up --build` del stack completo y pruebas a través del gateway:
  - HTTPS `/health` (→ hello) y `/api/game/state` (→ game-service) OK.
  - **WSS a través del gateway** `wss://localhost/ws`: conecta y recibe el estado
    inicial (`GATEWAY_WSS_OK`). Confirma terminación SSL + upgrade WSS + routing.
- **Sin commit propio** (verificación); resultados anotados aquí.

---

## Segunda tanda (petición del usuario): draft + combate interactivo

### F14 — Draft de equipos 3v3 (pool de 12) [backend] ✅
- **Qué:** roster de 12 Pokémon (`MatchManager.ROSTER_NAMES`, mezcla de tipos/patrones).
  `GET /api/game/roster` (12 plantillas cacheadas) y `POST /api/game/start`
  (`{player1:[3], player2:[3]}` → coloca 3v3 y arranca). Partida por defecto ahora 3v3.
- **Verificación:** smoke HTTP → roster=12, start coloca 3+3 (status active), start inválido → 400.

### F15 — Combate interactivo por turnos [backend] ✅
- **Qué:** `GameService` con máquina de combate. Atacar ya **no** resuelve al instante:
  entra en `status:'combat'` con `CombatState` (atacante/defensor, HP vivos, turno).
  Acciones `ATACAR / HABILIDAD / OBJETO / HUIR` (`POST /api/game/combat/action` y WSS
  `combat_action`), validadas y resueltas en servidor (HABILIDAD ×1.6 cuesta 1 candy;
  OBJETO cura 30% cuesta 2 candies; HUIR con golpe libre del rival). Al KO el vencedor
  ocupa la casilla y se comprueba victoria.
- **Verificación:** `tsc` limpio, **23/23 tests**, smoke HTTP de guardas.
- **Commit:** `feat(game): 3v3 draft + interactive turn-based combat`

### F16 — Pantalla de Draft [frontend] ✅
- **Qué:** `views/hub/DraftView.ts`: pide `/api/game/roster` (12), muestra tarjetas con
  sprite/tipo/patrón; el Jugador 1 elige 3 y luego el 2 (los del P1 quedan bloqueados);
  al confirmar hace `POST /api/game/start` y entra al tablero. Flujo cableado en `main.ts`
  (menú → draft → partida) e `index.html` (`#draft-layer`).

### F17 — Escena de combate interactivo [frontend] ✅
- **Qué:** `views/CombatView.ts`: overlay estilo lucha (fondo de arena, atacante a la
  izquierda volteado y defensor a la derecha, barras de HP), **menú de acciones**
  (ATACAR/HABILIDAD/OBJETO/HUIR) habilitadas según recursos, y log de combate. Integrada
  en `GameController` (render en `status:'combat'`, bloquea el tablero, envía acciones a
  `/api/game/combat/action`). Sincroniza en vivo por WSS.

### F18 — Mejora del menú principal + fix Vite ✅
- **Qué:** `MainMenuView` con acción principal destacada (PARTIDA LOCAL · Draft 3v3),
  instrucciones breves, opciones "pronto" claras y handler de Ranking. `vite.config.ts`:
  `allowedHosts: true` (evita el bloqueo anti DNS-rebinding de Vite 8 tras el gateway).
- **Verificación (F16-F18):** `tsc --noEmit` limpio + **`vite build` OK** (17 módulos) +
  `docker compose up --build`: frontend servido por HTTPS (`<title>` presente vía
  `localhost`), roster=12, estado activo.
- **Commit:** `feat(frontend): draft screen + interactive battle scene + menu polish`

### F19 — Combate más claro (2 fases) + menú de 2 jugadores ✅
- **Problema reportado:** el combate "salía sin dar victoria/derrota, confuso, sin restar
  vida"; el menú no aclaraba si era 1 o 2 jugadores.
- **Causa raíz:** al hacer KO, el backend finalizaba el combate al instante (`combat=null`),
  así que la escena desaparecía de golpe sin mostrar resultado. (La resta de vida y la
  victoria SÍ funcionaban — confirmado con test multironda; era un problema de UX/timing.)
- **Qué se hizo:**
  - Backend: combate en **dos fases**. Al KO/huida se pasa a `combat.status:'finished'`
    (con `winnerId/loserId/outcome`) sin aplicar aún; nuevo `POST /api/game/combat/continue`
    (+ WSS `combat_continue`) aplica el resultado al tablero. Guarda contra actuar sobre un
    combate resuelto. `loserId` añadido al estado.
  - Frontend `CombatView`: **turno arriba centrado y grande** ("TURNO: POKÉMON (player)"),
    barras de HP **alineadas con los sprites** y resaltando al que actúa, última acción
    prominente, y **pantalla de resultado** ("¡X venció a Y!" / "X huyó") con botón CONTINUAR.
  - Menú: entrada principal inequívoca **"PARTIDA LOCAL · 2 VS · 👥 2 JUGADORES"** (misma
    pantalla), y opciones de 1 jugador/online marcadas 🔒 (pronto).
- **Verificación:** **24/24 tests**, `tsc` limpio (back y front), `vite build` OK.
- **Commit:** `fix(game): two-phase combat with result screen + clearer 2-player menu`

---

## Resumen del estado al cierre de la sesión

**Hecho y verificado (Docker):**
- Seguridad: purga de API key del historial de la rama (rotación pendiente por el usuario).
- Backend `game-service` en **MVC** limpio con SQLite (sqlite3): modelos, servicios,
  controladores, rutas, `app`/`server`.
- Reglas **autoritativas**: turnos, validación por patrón, combate por turnos,
  modificadores de terreno, economía (Catan), condición de victoria, persistencia +
  graceful shutdown.
- **WSS** (sync de tablero + chat) con difusión autoritativa, enrutado por el gateway.
- Frontend (TS + Tailwind, MVC): render del tablero, turnos, resaltado de
  movimientos/ataques, panel de recursos, log, combate, victoria y **sync en vivo por WSS**.
- 22 tests unitarios/integración verdes; typechecks limpios; `docker compose up` OK.

**Pendiente (Fases 1/3/4 del plan) — no abordado esta noche:**
- `auth-service` real (JWT/OAuth2/2FA), `user-service`, `pokeapi-proxy` + Redis,
  `status-service`, `mail-service`, RabbitMQ, Vault, ModSecurity (WAF), IA, pruebas de carga.
- El auth actual es **mock** (transición) en `game-service`: no usar en producción.

**Acción requerida por el usuario:**
1. 🔴 Rotar/revocar la Google API Key que estaba en `.agents/mcp.json` (ver F1.5).
2. Revisar la rama `feat/overnight-improvements` y mergear a `main` si procede
   (recordando que `main` local aún contiene el commit con el secreto).
