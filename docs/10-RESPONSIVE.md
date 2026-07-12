# RESPONSIVE.md — Refactor de responsividad del frontend

> Rama: `refactor/responsive`
> Objetivo: que el proyecto sea usable en **escritorio, tablet y móvil (vertical)**
> "dentro de lo posible", sin rehacer el motor del juego ni romper la estética
> retro 8-bit.

---

## 1. Punto de partida (diagnóstico)

El frontend (TypeScript + Tailwind v4, sin framework) renderizaba **todo** —menús
y tablero— dentro de un lienzo fijo de **1600×1000 px** (`#game-wrapper`) que se
reducía con `transform: scale()` en `resizeGameArea()` para caber en la pantalla.

Problemas:

- **Escalado uniforme.** En pantallas pequeñas todo encogía por igual: en un móvil
  en vertical el juego quedaba como un rectángulo 16:10 minúsculo e ilegible.
- **Breakpoints inertes.** Prácticamente no había clases responsive (`sm:`/`md:`/`lg:`)
  y, aunque las hubiera, los menús vivían dentro del lienzo de 1600 px, así que su
  layout se calculaba siempre a 1600 px y luego se escalaba: los breakpoints de
  Tailwind (que miden el *viewport*) no podían reordenar nada útil.
- **Medidas fijas en px.** El shell de menús (`panel.ts`) y muchas vistas usaban
  `width:1200px`, `font-size:34px`, `padding:40px`, etc.

---

## 2. Decisión de arquitectura: enfoque **híbrido**

Un tablero de juego 16:10 con estado autoritativo **no** debe "reflowar" (perdería
su geometría hexagonal). Pero los **menús** sí pueden y deben adaptarse. De ahí el
enfoque híbrido, elegido con el usuario:

| Zona | Estrategia | Motivo |
|------|-----------|--------|
| **Tablero de juego** (`#game-layer`, HUD, combate, minimapa/chat) | **Scale-to-fit** (se mantiene el lienzo 1600×1000 escalado) | Preserva la relación de aspecto y la geometría del tablero |
| **Menús / hub** (`#hub-layer`) | **Layout fluido** a tamaño real del dispositivo (Tailwind `sm/md/lg` + `clamp()`) | Legibilidad y usabilidad reales en móvil/tablet |
| **Draft** (`#draft-layer`) | **Layout fluido** a tamaño real | Es una pantalla de selección, no necesita el lienzo |
| **Móvil vertical + tablero** | **Overlay "gira el dispositivo"** | El tablero 16:10 no es jugable en portrait |

---

## 3. Cambio estructural clave (capas)

**El menú y el draft se sacaron del lienzo escalado.** Ahora cuelgan directamente
de `#app` (viewport real), igual que ya hacían `#welcome-layer` e `#inventory-layer`.
Solo el **tablero** permanece dentro del `#game-container` que se escala.

```
#app  (100dvh, viewport real)
├── #welcome-layer   z-100  (intro/cinemática, full-viewport)
├── #inventory-layer z-90   (inventario, full-viewport)
├── #hub-layer       z-80   (MENÚS  → tamaño real, overflow-y-auto)   ← MOVIDO
├── #draft-layer     z-85   (DRAFT  → tamaño real, overflow-y-auto)   ← MOVIDO
├── #rotate-overlay  z-95   (aviso "gira el dispositivo", solo móvil vertical en juego)
└── #game-container  (transform: scale(), scale-to-fit)
    ├── #game-wrapper  1600×1000  → #game-layer (tablero + HUD + combate)
    └── #right-sidebar 360px       (minimapa + narrador + chat)
```

Consecuencia: dentro de `#hub-layer` y `#draft-layer`, los breakpoints de Tailwind
**sí** responden al ancho real del dispositivo, y `overflow-y-auto` permite scroll
vertical en pantallas bajas.

Archivos tocados: `services/frontend/index.html`, `services/frontend/src/main.ts`.

Otros ajustes en `index.html`:
- `<meta viewport>` con `viewport-fit=cover` (notches móviles).
- `#app` usa `h-dvh` (altura real del viewport móvil, no `100vh`).

---

## 4. Breakpoints y escala

Se usan los breakpoints por defecto de Tailwind:

| Prefijo | Ancho mín. | Dispositivo objetivo |
|---------|-----------|----------------------|
| (base)  | 0px       | Móvil vertical (~360–430px) |
| `sm:`   | 640px     | Móvil grande / tablet vertical |
| `md:`   | 768px     | Tablet |
| `lg:`   | 1024px    | Tablet horizontal / portátil |
| `xl:`   | 1280px    | Escritorio |

Para tamaños que estaban "cableados" en px (fuentes de rótulos, paddings del shell)
se usa **`clamp(min, Xvw, max)`**: encoge en móvil y recupera el tamaño completo en
escritorio, sin necesidad de múltiples breakpoints.

---

## 5. Patrones de refactor aplicados

Estos son los patrones que se aplicaron de forma sistemática (útil como guía para
futuras vistas):

1. **Anchos fijos** `style="width:NNNpx"` / `w-[NNNpx]` → `w-full max-w-*`
   (mapa: ≤400→`max-w-sm`, ~500→`max-w-md`, ~640→`max-w-xl`, ~800→`max-w-3xl`,
   ~1000→`max-w-5xl`).
2. **Grids de columnas fijas** → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`
   (miniaturas: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 …`), con `gap-2 sm:gap-4`.
3. **Fuentes en px en línea** → `clamp(min, Xvw, NNpx)`.
4. **Padding/márgenes grandes** → responsive (`p-8` → `p-4 sm:p-8`).
5. **Alturas fijas** que cortan contenido → `max-h-[60–70vh] overflow-y-auto`.
6. **Tablas anchas** → envueltas en `overflow-x-auto` (scroll horizontal contenido).
7. **Filas flex que desbordan** → `flex-col sm:flex-row` o `flex-wrap gap-2`.
8. **Layouts de 2 columnas** → apilados en móvil (`flex-col lg:flex-row`).

Se respetó estrictamente la **identidad visual** (colores, fuente `Press Start 2P`,
bordes 8-bit, `image-rendering: pixelated`): solo se hizo el layout fluido.

---

## 6. Shell compartido: `panel.ts`

`src/views/hub/panel.ts` es el mayor multiplicador: casi todos los menús usan
`hubPanel()`, `panelTitle()`, `panelCard()`, `menuButton()`, `backButton()`.
Se convirtió a fluido, así que la mayoría de menús se volvieron responsive "gratis":

- `hubPanel`: `max-width: min(width px, 96vw)`, `min-height: min(minHeight px, 82vh)`,
  `padding: clamp(16px, 4vw, 40px)`. El contenedor externo tiene `min-h-full` y la
  capa `#hub-layer` aporta el `overflow-y-auto`.
- `panelTitle`: `font-size: clamp(18px, 4.5vw, 34px)`.
- `panelCard`: `padding: clamp(14px, 2.5vw, 28px)`.
- `menuButton`: `padding` y `font-size` con `clamp()`; sublabels `text-[9px] sm:text-[10px]`.
- `backButton`: `font-size: clamp(11px, 2vw, 13px)`.

---

## 7. Overlay de rotación (móvil vertical)

`#rotate-overlay` (en `index.html`) se muestra **solo** cuando el tablero está activo
y el dispositivo está en vertical y es estrecho. Lógica en `main.ts`
(`updateRotateOverlay()`), llamada desde `resizeGameArea()` (que a su vez se dispara
en `resize` y al entrar/salir de partida):

```ts
const inGame = !gameLayer.classList.contains('hidden');
const isPortraitPhone = window.innerHeight > window.innerWidth && window.innerWidth < 768;
// show = inGame && isPortraitPhone
```

Los menús NO muestran este aviso (sí reflowan).

---

## 8. Vistas modificadas

Shell + estructura:
- `index.html` — reestructuración de capas, viewport, `h-dvh`, overlay de rotación.
- `src/main.ts` — `resizeGameArea()` + `updateRotateOverlay()`.
- `src/views/hub/panel.ts` — shell fluido (clamp / max-width).

Vistas del hub (layout fluido, grids responsive):
- `MainMenuView`, `PlayMenuView`, `SinglePlayerMenuView`, `MultiplayerMenuView`,
  `SettingsView`, `LoginView`, `AvatarCreationView`
- `StarterSelectionView`, `OwnedTeamPickerView`, `LocalSetupView`, `InventoryView`
- `ShopMenuView`, `AuctionHouseView`, `DraftView`
- `CommunityMenuView`, `LobbyView`, `WelcomeView`

> El detalle de cambios por vista se resume en la sección 10 (changelog).

Vistas **no** modificadas (parte del tablero escalado, se adaptan por `scale`):
`BoardView`, `CombatView`, `HUDView`, `MinimapView`, `EntityView` y el
`#right-sidebar` (minimapa/narrador/chat).

---

## 9. Cómo probar

1. Levantar el stack (o usar el contenedor de dev con hot reload):
   ```bash
   docker exec transcendence-frontend sh -c 'cd /app/services/frontend && npx tsc --noEmit'
   ```
2. Abrir la app y usar las **DevTools → modo dispositivo** (Ctrl/Cmd+Shift+M).
   Probar anchos: **390px** (móvil), **768px** (tablet), **1280px+** (escritorio).
3. Comprobar en cada uno:
   - Menús (login, principal, jugar, tienda, subastas, comunidad, ajustes,
     inventario, draft, lobby): sin scroll horizontal, texto legible, botones a ancho
     completo en móvil, grids que reordenan columnas.
   - Tablero en **móvil vertical**: aparece el overlay "gira el dispositivo".
   - Tablero en **horizontal**: se escala para caber, jugable.

---

## 10. Changelog por vista

**Estructura / shell**
- `index.html` — `#hub-layer` y `#draft-layer` movidos a nivel de `#app` (tamaño real);
  `viewport-fit=cover`; `#app` con `h-dvh`; nuevo `#rotate-overlay`.
- `main.ts` — `resizeGameArea()` documentado + `updateRotateOverlay()`.
- `panel.ts` — `hubPanel`/`panelTitle`/`panelCard`/`menuButton`/`backButton` con
  `clamp()` y `max-width: min(px, 96vw)`.
- `MainMenuView` — lista de botones `width:560px` → `w-full max-w-xl`.

**Menús**
- `PlayMenuView` — contenedor de botones `width:560px` → `w-full max-w-xl`.
- `SinglePlayerMenuView` — grid de dificultades `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`;
  SURVIVAL `col-span-1 sm:col-span-2`; título con `clamp()`.
- `MultiplayerMenuView` — contenedores `width:560px` → `w-full max-w-xl`; etiqueta con `clamp()`.
- `SettingsView` — escala `scale-125 lg:scale-150` → `scale-100 sm:scale-125 lg:scale-150` + `px-2`.
- `LoginView` — panel `max-w-2xl` → `max-w-md`; padding y tipografías con `clamp()`.
- `AvatarCreationView` — escala con base móvil; grid de avatares `gap-2 sm:gap-3`;
  input/botón `w-64` → `w-full max-w-xs`.

**Selección (grids)**
- `StarterSelectionView` — starters `grid-cols-4` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, `max-w-xl`.
- `OwnedTeamPickerView` — mismo grid; `max-height:420px` → `min(420px, 60vh)`; botones `flex-wrap`.
- `LocalSetupView` — escala con base móvil (`scale-100 md:scale-110 lg:scale-150`); padding responsive.
- `InventoryView` — layout `flex-col md:flex-row` (se apila en móvil); sprite `clamp(120px,30vw,220px)`;
  scroll vertical; cabecera `flex-wrap`.

**Feature**
- `ShopMenuView` — pokéballs `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`; contenedores `w-full max-w-*`.
- `AuctionHouseView` — listas/formulario `w-full max-w-*`; filas de subasta con `flex-wrap` + `min-w-0`.
- `DraftView` — grid `grid-cols-6` → `grid-cols-3 sm:grid-cols-4 md:grid-cols-6`; scroll vertical;
  barra inferior `flex-col sm:flex-row`.

**Grandes**
- `CommunityMenuView` — anchos fijos → `w-full` + `max-width` tope; listas/chat DM acotados a `vh`;
  grid de regalo `grid-cols-1 sm:grid-cols-2`.
- `LobbyView` — escala con base móvil (`scale-100 sm:scale-105 lg:scale-125`); botones de modo `flex-wrap`.
- `WelcomeView` — sin cambios (ya era responsive: `min(95vw,…)`, `vh`, `md:`/`lg:`).

**Verificación:** `tsc --noEmit` → OK · `vite build` → OK (45 módulos, CSS 44 kB).

---

## 11. Trabajo futuro (fuera de alcance)

- **Controles táctiles** para el tablero (arrastre/tap) — requeriría tocar el motor.
- **Layout portrait del tablero** (rediseño del HUD para vertical) en vez del overlay.
- Auditar el `#right-sidebar` (chat/minimapa) para un modo compacto en móvil horizontal.
