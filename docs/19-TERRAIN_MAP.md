# TERRAIN_MAP.md — Terrenos completos en el mapa: hierba alta, montaña y gráficos

> Implementado en el ticket **T1.0** (Épica 1 · prerrequisito del sigilo) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Completa la generación procedural y los
> gráficos de los biomas que existían como tipo pero no en el mundo real. Vigente desde
> 2026-07-13.

## Por qué existe

Los 8 biomas están definidos (`domain.ts` `BIOMES`) con reglas de movimiento/daño, pero:

- El generador procedural (`mapGenerator.ts` `classify`) solo producía WATER, SAND, ICE,
  FIRE, GRASS y (desde T0.2) SWAMP. **Nunca generaba `TALL_GRASS` ni `MOUNTAIN`.**
- El frontend solo tenía textura para FIRE/WATER/GRASS/SAND/ICE; SWAMP se pintaba con un
  **tinte** sobre hierba y MOUNTAIN/TALL_GRASS caían a hierba.

Consecuencia: **el sigilo (Épica 1) no tenía terreno donde ocurrir** (se basa en
`TALL_GRASS`), la montaña no existía y el pantano no tenía gráfico propio. T1.0 lo
completa como prerrequisito de T1.1/T1.2.

## Generación — `services/game-service/src/engine/mapGenerator.ts`

`classify` (modelo mini-Whittaker) añade dos biomas:

- **`MOUNTAIN`** (roca): en `elevation > mountainLevel`, cumbre **helada** si fría
  (`temperature < 0.35` → ICE), **volcánica** solo si seca (`humidity < 0.58` → FIRE), y el
  resto **roca** (MOUNTAIN). Antes todo lo húmedo de alta cota caía en GRASS.
- **`TALL_GRASS`** (pradera húmeda/alta): tras el pantano (tierras bajas), en tierras
  medias húmedas `humidity > 0.5 && temperature > 0.35`.

Reparto real con la seed por defecto (`transcendence-default`) — los **8 biomas** presentes:

| Mapa | TALL_GRASS | MOUNTAIN | SWAMP | FIRE |
|------|-----------|----------|-------|------|
| Normal (r=20) | ~14% | ~1% | ~5% | ~2% |
| Arena (r=42) | ~11% | ~4% | ~8% | ~4% |

Los spawns ya evitan MOUNTAIN/SWAMP (`spawns.ts` preferencias), sin cambios.

## Gráficos — `services/frontend/public/assets/` + `BoardView.ts`

Assets PNG propios (1024²): `swamp.png`, `tall_grass.png`, `mountain.png` (texturas base)
y dos overlays de **relieve** transparentes: `tall_grass_relief.png`,
`mountain_relief.png` (dan **altura** a los terrenos con relieve).

[`BoardView.ts`](../services/frontend/src/views/BoardView.ts):
- `textures`: entradas SWAMP/TALL_GRASS/MOUNTAIN (base) + `reliefs` (TALL_GRASS/MOUNTAIN),
  cargados en el constructor e incluidos en `preloadImages`.
- `getBiomeTexture`: casos para los tres biomas nuevos.
- **Se elimina el tinte-hack de SWAMP** (T0.2): ahora tiene textura real.
- **`drawRelief(tile, x, y, fogged)`**: dibuja el overlay de relieve de MOUNTAIN/TALL_GRASS
  centrado en el hex y **desplazado hacia arriba** (altura). Como el bucle de render pinta
  por Y (`getGeom` ordena por `y`), los tiles de delante ocluyen el relieve de forma
  natural. Bajo **niebla de despliegue** el relieve se oscurece (`ctx.filter =
  brightness(0.35)`) para no asomar por encima del overlay hexagonal del tile.
- Colores de *fallback* extendidos a los nuevos biomas (mientras cargan/si fallan).

[`MinimapView.ts`](../services/frontend/src/views/MinimapView.ts): colores propios para
`TALL_GRASS` y `MOUNTAIN` (SWAMP ya estaba).

> El "baile" del relieve con el zoom se corrigió: `drawRelief` usa `HEX_SIZE` en crudo (el
> bucle ya aplica `ctx.scale(zoom)`); multiplicar por zoom lo escalaba al cuadrado.

## Verificación

- Test: [`services/game-service/test/mapGenerator.test.ts`](../services/game-service/test/mapGenerator.test.ts)
  — con la seed por defecto, el mapa normal y la arena **contienen** TALL_GRASS, MOUNTAIN y
  SWAMP (>0), y siguen generando WATER/GRASS/FIRE. game-service 36/36.
- `tsc` limpio (game-service + frontend); imágenes Docker reconstruidas, stack sano.
- Smoke visual (usuario): parcelas de hierba alta (briznas en relieve), montañas (pico con
  altura) y pantano (lodo), distinguibles en tablero y minimapa.

## Pendiente / relacionado

- El sigilo real (T1.1 revelación por AoE, T1.2 flash) ya tiene terreno donde ocurrir.
- Presentación local (ocultación desde la perspectiva del humano, cámara, agua, nombres):
  ver [`20-LOCAL_PRESENTATION.md`](20-LOCAL_PRESENTATION.md).
