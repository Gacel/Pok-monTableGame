# TERRAIN_EFFECTS.md — Efectos de terreno de fin de turno (lava, pantano, curación)

> Implementado en el ticket **T0.2** (Épica 0 · Fundaciones) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Documenta el refactor de los efectos
> de terreno que se aplican al **final de cada turno**, la activación del daño de pantano
> (antes código muerto), la vía de curación (preparada para T2.2) y la generación de
> losetas de pantano en el mapa procedural. Vigente desde 2026-07-12.

## Por qué existe

El motor solo aplicaba **daño de lava** al final del turno. El resto de efectos de
terreno estaban a medias:

- **Daño de pantano = código muerto.** `terrainDamage()`
  ([`engine/environment.ts`](../services/game-service/src/engine/environment.ts)) ya
  calculaba 2 de daño tóxico para `SWAMP`, pero el consumidor `applyLavaDamage()` lo
  invocaba con el bioma **hardcodeado a `'FIRE'`** (`terrainDamage(occupant, 'FIRE')`),
  así que nunca se evaluaba el bioma real de la casilla y el pantano jamás dañaba.
- **Sin vía de curación.** No existía forma de que el terreno **cure** (valor negativo),
  algo que necesita T2.2 (regeneración de Planta en hierba alta, 8% maxHp/turno).
- **El mapa no tenía pantanos.** El generador procedural `classify()` nunca producía el
  bioma `SWAMP`, con lo que la mecánica era intestable en juego real.

T0.2 generaliza el efecto de fin de turno a **todos los biomas**, activa el pantano,
habilita la maquinaria de curación con clamp a `[0, maxHp]`, emite eventos de turno
(canal de [T0.1](15-TURN_EVENTS.md)) y **siembra pantanos** en el mapa habitual.

## Cambio 1 — `applyLavaDamage()` → `applyEndOfTurnEffects()`

Fichero: [`services/game-service/src/services/GameService.ts`](../services/game-service/src/services/GameService.ts)
(llamado desde `endTurn`).

Antes solo miraba casillas `FIRE`. Ahora recorre **todos los ocupantes** y aplica el
`terrainDamage` del **bioma real** de su casilla. Lógica:

```
para cada ocupante (deduplicado por id):
  # lavaTurns: escala en FIRE consecutivo (salvo FIRE/FLYING); se reinicia fuera de lava
  if biome == FIRE and type not in {FIRE, FLYING}: occ.lavaTurns += 1
  else if biome != FIRE:                            occ.lavaTurns = 0

  dmg = terrainDamage(occ, biome)          # >0 daño, <0 curación, 0 nada
  if dmg == 0: continue

  occ.hp = clamp(occ.hp - dmg, 0, occ.maxHp)   # soporta daño Y curación sin pasar maxHp

  if dmg > 0:
     evento damage (delta = -dmg) + log por bioma (lava / pantano / genérico)
     if occ.hp <= 0: log KO + evento ko + dropBall + retirar pieza
  else:                                         # curación (dmg < 0)
     evento heal (delta = -dmg, positivo) + log "♻️ … se regenera"
```

Detalles clave:

- **Deduplicación por `occupant.id`** con un `Set` (mismo patrón que `cast`): un Pokémon
  `large` ocupa varios hexes y no debe sufrir el efecto varias veces. Hoy todos son
  `medium` (1 hex); es defensa de cara a T4.1.
- **Clamp `Math.max(0, Math.min(maxHp, hp - dmg))`**: la misma fórmula sirve para daño
  (dmg>0 baja HP) y curación (dmg<0 sube HP) sin superar `maxHp` — criterio de aceptación
  de T0.2. Ningún terreno devuelve negativo **todavía**; la regla concreta llega en T2.2.
- **Logs por bioma:** la lava conserva su mensaje con `lavaTurns`
  (`¡… se quema en la lava (-N HP, turno k)!`); el pantano añade `☠️ … sufre el pantano
  (-N HP).`; hay un genérico de reserva. La curación: `♻️ … se regenera (+N HP).`
- **KO por terreno:** al llegar a 0 HP se emite `ko`, se suelta la bola (`dropBall`) y se
  retira la pieza, igual que hacía la lava. El KO ya no es "por la lava" sino "por el
  terreno" (mensaje generalizado).
- `terrainDamage` **no cambia de firma ni de comportamiento**: el fix del código muerto es
  puramente del lado consumidor (usar `tile.biome` en vez de `'FIRE'`).

### Comportamiento del daño de terreno (recordatorio de `terrainDamage`)

| Bioma | Efecto |
|-------|--------|
| `FIRE` (lava) | 2 base (Agua 1, Planta/Hielo 4), **×2^(lavaTurns-1)** por turnos consecutivos. Fuego y Volador inmunes. |
| `SWAMP` (pantano) | 2 de daño tóxico constante. **Veneno y Acero inmunes**. Volador inmune. |
| `TALL_GRASS` | 0 hoy; **T2.2** hará que un Planta se cure 8% maxHp (devolverá negativo). |
| resto | 0 |

> El daño de terreno se aplica en **cada `endTurn`**, sobre todos los ocupantes, sin
> importar de quién sea el turno. Por eso la lava dobla turno a turno mientras la pieza
> siga encima (2 → 4 → 8 …).

## Cambio 2 — Generación de pantanos en el mapa procedural

Fichero: [`services/game-service/src/engine/mapGenerator.ts`](../services/game-service/src/engine/mapGenerator.ts)
(`classify`, modelo mini-Whittaker).

`classify()` nunca devolvía `SWAMP`. Se añade una regla de **humedal cálido de tierras
bajas** (antes del `return 'GRASS'` final):

```ts
if (humidity > 0.56 && temperature > 0.4 && elevation < o.seaLevel + o.beachWidth + 0.2)
  return 'SWAMP';
```

Es decir: mucha humedad + templado/cálido + poca elevación (justo por encima de la
costa) → pantano. Genera **pantanos contiguos junto al agua**, deterministas por seed.

Distribución con la seed por defecto (`transcendence-default`):

| Mapa | Radio | Losetas | SWAMP | (referencia: FIRE) |
|------|-------|---------|-------|--------------------|
| Normal | 20 | 1261 | **68** (~10% de tierra) | 35 |
| Arena | 42 | 5419 | **415** | 261 |

Los **spawns ya evitan** el pantano (`preference[SWAMP] = 2` en
[`engine/spawns.ts`](../services/game-service/src/engine/spawns.ts)), así que ningún
Pokémon nace encima.

## Cambio 3 — Render del pantano (frontend)

Los assets de bioma son texturas 1024×1024 y no hay una de pantano. En vez de crear un
asset nuevo, el pantano se dibuja con la **textura de hierba + un tinte turbio oscuro**
superpuesto, que lo distingue con claridad:

- [`services/frontend/src/views/BoardView.ts`](../services/frontend/src/views/BoardView.ts):
  `drawHex(x, y, img?, tint?)` acepta un tinte opcional que rellena el hexágono tras
  pintar la textura. En el bucle de render, `SWAMP` usa `rgba(58, 74, 44, 0.62)` sobre la
  textura de hierba (`getBiomeTexture` cae a hierba por `default`).
- [`services/frontend/src/views/MinimapView.ts`](../services/frontend/src/views/MinimapView.ts):
  color propio en el minimapa, `SWAMP: '#4a5a34'`.

## Eventos emitidos (canal de T0.1)

`applyEndOfTurnEffects` emite, respetando el filtrado de niebla de `getStateDTO`:

- `damage` (`delta < 0`) por lava/pantano.
- `ko` al caer una pieza por terreno (antes de retirarla).
- `heal` (`delta > 0`) — **vía preparada**; ningún terreno la dispara hasta T2.2.

Ver [`15-TURN_EVENTS.md`](15-TURN_EVENTS.md) para el contrato completo y el filtrado.

## Verificación

- Tests: [`services/game-service/test/environment.test.ts`](../services/game-service/test/environment.test.ts)
  — 11 tests: `terrainDamage` puro (escalado de lava, pantano 2, inmunidad Veneno/Acero,
  Volador inmune) + integración vía `endTurn` (pantano baja HP y emite `damage`; Veneno no
  recibe daño; lava escala 2→4→8; `lavaTurns` se reinicia fuera de la lava; KO por terreno
  retira la pieza y emite `ko`; invariante de clamp `hp ≤ maxHp`).
- `npm test` en game-service: **24/24** (11 nuevos + 13 de T0.1 sin regresión).
- `tsc --noEmit` limpio en `packages/shared`, `game-service` y `frontend`.
- `make up` reconstruye las 4 imágenes y el stack arranca sano (game-service healthcheck
  verde). Comprobación visual del usuario: pantanos oscuros junto al agua (tablero y
  minimapa), un Pokémon no-Veneno/Acero pierde HP al pasar turno sobre pantano.

## Pendiente / cómo se extiende

- **T2.2 (curación de Planta):** hará que `terrainDamage` devuelva **-8% maxHp** para un
  Pokémon de Planta sobre `TALL_GRASS`. La maquinaria (clamp + evento `heal` + log) ya
  está lista aquí; T2.2 solo cambia `terrainDamage` y añade sus tests/feedback.
- **T2.3 (números flotantes):** consumirá los eventos `damage`/`heal` de fin de turno
  para pintar los números sobre el sprite (hoy T0.2 no tiene feedback visual de números).
- **`TALL_GRASS` en el mapa:** el generador procedural tampoco lo produce todavía
  (relevante para el sigilo de la Épica 1); se abordará cuando toque esa mecánica.
