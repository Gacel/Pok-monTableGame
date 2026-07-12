# HEX_GEOMETRY.md — Geometría hexagonal: redondeo cúbico y trazado de línea

> Implementado en el ticket **T0.3** (Épica 0 · Fundaciones) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Documenta las primitivas de geometría
> hexagonal añadidas al motor: conversión axial↔cube, `hexRound` (redondeo cúbico) y
> `hexLineDraw` (línea recta real punto a punto). Lógica pura, sin runtime todavía.
> Vigente desde 2026-07-12.

## Por qué existe

El motor sabía medir distancias (`hexDistance`, cúbica) y vecindad, pero **no sabía
trazar la línea recta real entre dos hexágonos**. Lo más parecido era `getLineArea`
([`packages/shared/src/combat.ts`](../packages/shared/src/combat.ts)), que **encaja la
trayectoria a una de las 6 direcciones** (elige `bestDir` por `hexDistance` mínima y
avanza recto por ella) — sirve para el AoE tipo "línea" de un ataque, pero **no** para
saber qué casillas cruza de verdad la recta A→B en cualquier ángulo.

Eso lo necesitan mecánicas posteriores:

- **Línea de visión / bodyblocking** (T4.3): trazar del atacante a cada hex del AoE y ver
  si un `large` intermedio intercepta.
- **Empuje / dash** (T3.1 / T3.3): dirección y trayectoria exactas del desplazamiento.

T0.3 aporta esa base geométrica como **lógica pura del motor** (`engine/hex.ts`), con
tests exhaustivos y **sin consumidores aún** (los añaden T3.x/T4.x).

## Coordenadas: axial vs. cube

El `Hex` de shape ([`packages/shared/src/domain.ts`](../packages/shared/src/domain.ts)) es
**axial** `{ q, r }`. La geometría de líneas es más simple en **cube** `{ q, r, s }` con
el invariante `q + r + s = 0` (la 3ª coord es redundante: `s = -q - r`).

```ts
export interface Cube { q: number; r: number; s: number }
export function axialToCube(h: Hex): Cube   // { q, r, s: -q-r }
export function cubeToAxial(c: Cube): Hex    // { q, r }
```

## `hexRound(frac): Hex`

Dado un hex **fraccionario** (axial), devuelve el hex entero más cercano **manteniendo el
invariante cúbico**. Redondea las tres coords cúbicas y **corrige la de mayor desviación**
(así la suma vuelve a 0). Es la misma técnica que el `axialRound` que el frontend ya usaba
para píxel→hex ([`BoardView.ts`](../services/frontend/src/views/BoardView.ts)), ahora en el
motor y reutilizable. Normaliza `-0`→`0` para igualdad estructural limpia.

## `hexLineDraw(a, b): Hex[]`

Traza la recta real interpolando y redondeando cada paso:

```
N = hexDistance(a, b)
if N === 0 → [copia de a]
para i en 0..N:  t = i/N;  push(hexRound(lerp_axial(a, b, t)))
```

- Devuelve la secuencia **contigua** de A a B, **ambos incluidos** (longitud `N + 1`);
  cada par consecutivo es adyacente (`hexDistance === 1`).
- **Nudge cúbico `(ε, ε, -2ε)`** (`ε = 1e-6`) aplicado a ambos extremos: rompe empates
  cuando la recta cae justo en la frontera entre dos hexes, de forma **determinista** y
  **simétrica** (recorrer B→A da la misma cadena invertida, porque el nudge es idéntico en
  valor absoluto y los puntos interpolados coinciden).

Diferencia con `getLineArea`: aquel **encaja** a 1 de 6 direcciones (bueno para el patrón
de AoE "line"); `hexLineDraw` sigue la recta **punto a punto** en cualquier ángulo (bueno
para LoS y trayectorias).

## Verificación

- Tests: [`services/game-service/test/hex.test.ts`](../services/game-service/test/hex.test.ts)
  — 9 tests: conversión axial↔cube (inversa, `s=-q-r`), `hexRound` (redondeo, invariante
  `q+r+s=0`, idempotencia sobre enteros), `hexLineDraw` (`a==b`, línea sobre eje, diagonal
  cúbica, propiedades generales en 5 direcciones/longitudes —extremos, longitud `N+1`,
  contigüidad, validez cúbica— y simetría B→A).
- `npm test` en game-service: **33/33** (9 nuevos + 24 previos sin regresión).
- `tsc --noEmit` limpio; la imagen Docker de game-service compila y arranca sana.

## Pendiente / cómo se usa

- **T3.1 (empuje):** dirección atacante→víctima y desplazamiento N hexes.
- **T3.3 (dash):** trayectoria atacante→objetivo, daño a lo atravesado.
- **T4.3 (LoS/bodyblocking):** línea del atacante a cada hex del AoE; oclusión por `large`.

Ninguna toca este fichero de nuevo salvo para consumir `hexLineDraw`/`hexRound`.
