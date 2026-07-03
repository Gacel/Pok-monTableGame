# FRONTEND_MENU.md — Árbol de menús del hub

> Documento vivo. Describe la **navegación del hub** (todas las pantallas fuera del
> tablero), su **estado real** y el **árbol objetivo** que estamos construyendo.
> Complementa `docs/ARCHITECTURE.md §2.2` (MVC frontend). Se actualiza a medida que
> las pantallas pasan a "Done".
>
> **Leyenda:** ⬜ pendiente · 🟧 en curso · ✅ hecho · 🔒 bloqueado (placeholder navegable).

---

## 1. Arquitectura de navegación (cómo funciona hoy)

La SPA es **TypeScript + Vite vanilla + Tailwind v4**, sin framework, sin router de
URLs. La navegación es un **"router" manual imperativo** en `services/frontend/src/main.ts`:

- Cada pantalla es una **clase `View`** en `src/views/hub/` con `constructor(container)`
  y `render()`, que inyecta su HTML vía `innerHTML` y engancha los listeners con
  `getElementById` / `querySelectorAll` justo después.
- La navegación se dispara por **funciones `show*()` exportadas de `main.ts`** que las
  vistas importan directamente (acoplamiento explícito). Cada `show*()` llama a
  `resetHubLayer()` (limpia `#hub-layer` y destruye el lobby si lo hay) y monta la vista.
- **Tres capas DOM fijas** superpuestas en `index.html`, conmutadas por
  visibilidad/opacidad (no hay un único contenedor):
  `#hub-layer` (menús, z-50) · `#draft-layer` (selección de equipos, z-55) ·
  `#game-layer` (tablero canvas, z-10) · `#right-sidebar` (minimapa/chat).
- **Estado**: no hay store global de "vista activa" (es implícita = lo montado en
  `#hub-layer`). Sí hay dos estados observables: `authState`
  (`src/auth/AuthState.ts`, sesión/usuario, `localStorage`) y la sesión de partida
  online (`src/state/MatchSession.ts`, `sessionStorage`, reconexión tras F5).
- La reactividad de auth (`authState.subscribe` en `main.ts`) actúa como **guard**:
  sin sesión → welcome/login; con sesión sin `username` → creación de avatar; con
  usuario → menú principal.
- Volver del tablero al hub: evento custom `document.dispatchEvent(new CustomEvent('return-to-menu'))`.

### Flujo de arranque (`bootstrap()` en `main.ts`)

```
checkSession()
 ├─ sin sesión ............... showWelcome()  (PULSA START)  →  showLogin()
 └─ con sesión
     ├─ sin username ......... showAvatarCreation()
     └─ con username
         ├─ partida online viva (F5) → tryRejoinOnline() reentra al tablero
         └─ si no ............ showMainMenu()
```

---

## 2. Estilo visual ("consola 8-bit")

- **Fuente:** `Press Start 2P` (Google Fonts), aplicada inline
  `style="font-family: 'Press Start 2P', monospace;"`. Sprites con `image-rendering: pixelated`.
- **Panel base (triple marco):** marco exterior `border-4 #fff` + `box-shadow: 0 0 0 4px #000`
  sobre panel interior `bg-blue-900 border-4 border-black`, y tarjetas internas
  `bg-white border-4 border-gray-800 shadow-[4px_4px_0_#000]`. Se repite en Login,
  MainMenu, MultiplayerMenu, LocalSetup, Settings y Lobby.
- **Botón con relieve:** `border-b-4 border-<color>-800 active:border-b-0 active:mt-1`
  + `box-shadow: 0 4px 0 #000`. Acento amarillo Pokémon (`bg-yellow-400`), acción
  principal roja (`bg-red-600`), online azul (`bg-blue-600`).
- **Colores por jugador (consistentes HUD↔draft):** P1 `#3b82f6`, P2 `#ef4444`,
  P3 `#a855f7`, P4 `#eab308`.
- **No hay componentes de UI abstraídos** (no existe `Button.ts`/`Panel.ts`): la
  reutilización es por copia de clases entre vistas. → *Ver §5, se introduce un helper
  de panel para estandarizar el marco ampliado.*

### Nota de layout (por qué el menú se ve como "un cuadrado pequeño")

El lienzo del juego es fijo **1600×1000** (`#game-wrapper` en `index.html`), escalado a
pantalla por `transform: scale()` en JS (`resizeGameArea()` en `main.ts`). Cada vista del
hub se envuelve además en `transform scale-125 lg:scale-150` y se limita con `max-w-lg`
(login) / `max-w-2xl` (resto) + tarjeta interna `max-w-sm`. Resultado: una tarjeta
centrada que **no aprovecha** el ancho del lienzo. **Objetivo (§5):** ampliar el panel
para ocupar el lienzo manteniendo el mismo estilo.

---

## 3. Modos de juego: estado real

Fuente de verdad de tipos: `packages/shared/src/lobby.ts`.
`GameMode = 'ffa' | 'teams'` · `MatchMode = 'local' | 'online'` · `MAX_PLAYERS = 4`.

| Modo | Estado | Notas |
|------|--------|-------|
| Multijugador **LOCAL** (hot-seat) | ✅ | `LocalSetupView` → 2-4 jugadores, `ffa` o `teams` (2v2 solo con 4) → `DraftView` → `POST /api/game/start`. |
| Multijugador **ONLINE** | ✅ | `LobbyView` (crear/buscar sala, WSS + polling REST) → draft por jugador → tablero. Reconexión F5. |
| **DRAFT** | ✅ | `DraftView`: 3 Pokémon del roster (`GET /api/game/roster`), sprites PokeAPI. |
| **UN JUGADOR / vs IA** | ⬜ | No hay motor de IA (ni front ni back). Botón deshabilitado hoy. |
| Dificultades IA (fácil/normal/difícil/hardcore) | ⬜ | No existen. Hardcore previsto tras logro (1000 monedas). |
| **SURVIVAL** | ⬜ | No existe. |
| **1 VS 1 / 2 VS 2 / BATTLE ROYALE** | 🟧 | No son modos explícitos: se **mapean** sobre lo existente (§4). |
| TIENDA / COMUNIDAD / CASA DE SUBASTAS | ⬜ | No existen. |

---

## 4. Árbol de menú OBJETIVO

```
PULSA START (WelcomeView ✅)
└─ LOGIN (LoginView ✅ · solo ajuste de ancho, diseño intacto)
   └─ MENÚ PRINCIPAL (MainMenuView 🟧 reestructurar)
      ├─ JUGAR
      │  ├─ UN JUGADOR
      │  │  ├─ IA FÁCIL            🔒 pronto (sin motor de IA)
      │  │  ├─ IA NORMAL           🔒 pronto
      │  │  ├─ IA DIFÍCIL          🔒 pronto
      │  │  ├─ IA HARDCORE         🔒 bloqueado · 1000 monedas (logro)
      │  │  └─ SURVIVAL MODE       🔒 pronto
      │  └─ MULTIJUGADOR
      │     ├─ LOCAL      → 1 VS 1 · 2 VS 2 · BATTLE ROYALE   (lanza flujo real)
      │     └─ EN LÍNEA   → 1 VS 1 · 2 VS 2 · BATTLE ROYALE   (lanza flujo real)
      │     └─ [toggle SURVIVAL en multijugador]  🔒 placeholder visual
      ├─ COMUNIDAD
      │  ├─ AMIGOS CONECTADOS                      🔒 pronto
      │  ├─ AÑADIR AMIGO → BUSCAR · RECOMENDADOS   🔒 pronto
      │  └─ ENVIAR REGALO → COSMÉTICO · POKÉMON · POKÉBALLS · MONEDAS · PLAN PREMIUM  🔒 pronto
      ├─ TIENDA
      │  ├─ COSMÉTICOS                             🔒 pronto
      │  ├─ POKÉBALL SORPRESA → NORMAL 500 · SUPERBALL 1000 · ULTRABALL 2000 · MASTERBALL 10000  🔒 pronto
      │  ├─ RECUPERA UN POKÉMON (solo perdido en Survival single player) · 10000  🔒 pronto
      │  ├─ ENVIAR OFERTA DE RECUPERAR POKÉMON (con contraoferta)  🔒 pronto
      │  └─ PLAN PREMIUM                           🔒 pronto
      └─ CASA DE SUBASTAS → todo lo comercializable  🔒 pronto
      (+ CONFIGURACIÓN ✅ · CERRAR SESIÓN ✅ como acciones secundarias)
```

### 4.1 Regla del árbol vs. lógica

Esta iteración construye **la navegación (el árbol) completa**, con estilo/diseño
consistente. Solo se cablea **lógica ya desarrollada**; el resto son **placeholders
navegables** (botones `🔒 pronto`, deshabilitados). Nada de backend nuevo.

### 4.2 Mapeo de modos multijugador (lógica real cableada)

Los modos del árbol se traducen a la config existente (`LocalGameConfig` / lobby):

| Botón | `players` | `gameMode` | Flujo |
|-------|-----------|------------|-------|
| 1 VS 1 | 2 | `ffa` | LOCAL: `startLocalGame({players:2, gameMode:'ffa'})`. ONLINE: sala 2. |
| 2 VS 2 | 4 | `teams` | Alianzas P1+P3 vs P2+P4 (`lobby.ts`). |
| BATTLE ROYALE | 3-4 | `ffa` | Todos contra todos (tope `MAX_PLAYERS=4`). |
| ARENA | 4 | `arena` | Mapa ≥4x (`GAME_ARENA_MAP_RADIUS=42` → 5419 tiles), spawns **aleatorios** (`pickRandomSpawns`), partida **persistente** (`GameService.persistent` → `checkWinCondition` no finaliza). |

### 4.3 Modo ARENA — estado (fase 1 hecha)

**Hecho (fase 1):** modo `arena` en `GameMode`; mapa ≥4x por modo (`MatchManager.loadBoard`);
spawns aleatorios (`engine/spawns.ts:pickRandomSpawns` + seed no determinista);
partida persistente que no termina (`GameService.persistent`, expuesto en el DTO).
Verificado: 4.30x tiles, spawns distintos por partida, `persistent:true`.

**Pendiente (fase 2):** entrada/salida **en caliente** (join a una arena `active`),
turnos dinámicos cuando entran/salen jugadores, y una arena global de `matchId`
fijo exenta del barrido/`evict` para que esté "siempre viva" con reingreso.

> **Survival en multijugador** (booleano): si activo, al vencer al Pokémon de otro
> jugador lo capturas (se suma a tus opciones de draft) o se elimina según el caso.
> Es lógica de juego **no desarrollada** → se deja como **toggle visual placeholder**
> hasta que exista soporte en el motor.

---

## 5. Ampliación del layout (mismo estilo, más pantalla)

**Problema:** el hub se renderiza como una tarjeta pequeña centrada (`scale-125/150` +
`max-w-2xl`/`max-w-sm`) que desaprovecha el lienzo 1600×1000.

**Solución (sin cambiar el estilo visual):**
- Nuevo helper compartido `src/views/hub/panel.ts` que reproduce **exactamente** el
  triple marco 8-bit pero con dimensiones grandes (p. ej. panel `~1200×720`,
  contenido en rejilla) y exporta la constante `FONT`. Elimina el hack
  `transform scale-*` y agranda con anchos/altos reales.
- Las vistas del hub pasan a usar el helper → un único sitio controla el tamaño y se
  evita la deriva por copia de clases.
- **Login (`LoginView`)**: **no se toca el diseño**; solo se ajusta para aprovechar el
  ancho (revisar `max-w-lg` + `scale`) sin alterar colores, tipografía ni composición.
- **WelcomeView (PULSA START)**: el **logo principal** sobre "PRESS START" se ve
  demasiado pequeño (`max-w-[90vw]` con `object-contain` pero sin ancho real forzado).
  Agrandarlo para que domine la pantalla, respetando la animación intro/pulse/float.

### 5.1 Disposición uniforme (estilo tienda)

Todas las pantallas del hub usan la **misma disposición**: `panelTitle` + `panelCard`
con una **lista vertical de `menuButton`** (icono + etiqueta + sublínea) y `backButton`.
Es la disposición del menú de la TIENDA, aplicada a MainMenu, JUGAR, MULTIJUGADOR
(paso canal), COMUNIDAD y UN JUGADOR. Los submenús con muchos ítems homogéneos
(regalo, pokéball sorpresa) usan rejilla dentro de la misma tarjeta.

### 5.2 Pokéballs (bitmap real)

En TIENDA → POKÉBALL SORPRESA, cada bola es el **sprite bitmap real** de PokeAPI
(`poke-ball`/`great-ball`/`ultra-ball`/`master-ball`) a **tamaño avatar** (`w-16 h-16`,
`image-rendering: pixelated`). Ver `ShopMenuView.ts` (`BALL_SPRITE`, `BALLS`).

---

## 6. Inventario de vistas del hub

| Vista | Archivo | Estado |
|-------|---------|--------|
| WelcomeView (PULSA START) | `src/views/hub/WelcomeView.ts` | ✅ |
| LoginView | `src/views/hub/LoginView.ts` | ✅ (ajuste de ancho) |
| AvatarCreationView | `src/views/hub/AvatarCreationView.ts` | ✅ |
| MainMenuView | `src/views/hub/MainMenuView.ts` | 🟧 reestructurar a árbol |
| PlayMenuView (JUGAR) | `src/views/hub/PlayMenuView.ts` | ⬜ nuevo |
| SinglePlayerMenuView (UN JUGADOR) | `src/views/hub/SinglePlayerMenuView.ts` | ⬜ nuevo (placeholders) |
| MultiplayerMenuView | `src/views/hub/MultiplayerMenuView.ts` | 🟧 añadir 1v1/2v2/BR |
| LocalSetupView | `src/views/hub/LocalSetupView.ts` | ✅ (reutilizada por presets) |
| LobbyView | `src/views/hub/LobbyView.ts` | ✅ |
| DraftView | `src/views/hub/DraftView.ts` | ✅ |
| CommunityMenuView (COMUNIDAD) | `src/views/hub/CommunityMenuView.ts` | ⬜ nuevo (placeholders) |
| ShopMenuView (TIENDA) | `src/views/hub/ShopMenuView.ts` | ⬜ nuevo (placeholders) |
| AuctionHouseView (SUBASTAS) | `src/views/hub/AuctionHouseView.ts` | ⬜ nuevo (placeholder) |
| SettingsView | `src/views/hub/SettingsView.ts` | ✅ |

Cada vista nueva añade su `show*()` en `main.ts` siguiendo el patrón existente.
