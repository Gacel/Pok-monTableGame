# TURN_EVENTS.md — Canal de eventos de turno (feedback visual)

> Implementado en el ticket **T0.1** (Épica 0 · Fundaciones) del roadmap
> [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md). Documenta el canal estructurado de
> eventos que el servidor emite en cada acción para que el frontend pueda animar
> (números flotantes, flashes, tweens). Vigente desde 2026-07-12.

## Por qué existe

El servidor es autoritativo: difunde el `MatchStateDTO` y el cliente solo renderiza.
Hasta ahora el cliente solo tenía un **log de texto lateral**; para animar "qué pasó"
(cuánto daño, a quién, KO, revelado, empuje…) tendría que **diffear** estados
consecutivos, lo cual es frágil y, con **niebla de guerra**, incorrecto (los estados
enemigos vienen censurados). El canal de eventos entrega esa información de forma
explícita, por acción, y respetando la niebla.

Es la **fundación del feedback visual**: lo consumirán T0.4 (primitivas de números
flotantes/flash/tween), T2.3 (números de daño/curación), T1.2 (flash de revelado),
T3.2/T3.4 (deslizamientos de empuje/dash) y T8.5 (captura).

## Contrato (`packages/shared/src/match.ts`)

```ts
export type TurnEventKind =
  | 'damage' | 'heal' | 'ko' | 'reveal' | 'knockback' | 'dash' | 'capture';

export interface TurnEvent {
  kind: TurnEventKind;
  pokemonId?: string;      // identidad de la pieza implicada
  hex?: Tile['hex'];       // posición para el número flotante / flash
  delta?: number;          // variación de HP con signo: daño negativo, curación positiva
  from?: Tile['hex'];      // origen de un desplazamiento (knockback/dash)
  to?: Tile['hex'];        // destino de un desplazamiento
}
```

Y en `MatchStateDTO`:
```ts
/** Eventos de la última acción para feedback visual. Efímero, no persistido. */
events?: TurnEvent[];
```

El frontend lo reexporta en [`services/frontend/src/models/Types.ts`]. Como
`MatchState = MatchStateDTO`, el campo está disponible en todo el cliente.

> **Estado de los `kind`:** T0.1 emitió `damage` y `ko`. **T0.2** añadió la **vía de
> emisión de `heal`** en los efectos de fin de turno (aún sin terreno que la dispare; la
> regla concreta de curación en hierba es T2.2). `reveal` lo emitirá T1.1,
> `knockback`/`dash` la Épica 3, `capture` la Épica 8. El union los define desde ya
> para que el contrato sea estable.

## Patrón: campo efímero por acción

`events` sigue **exactamente** el patrón de los campos `defeats` y `rewards` ya
existentes en `GameService`:

1. **Campo privado** `private events: TurnEvent[] = []`.
2. **Se resetea** (`this.events = []`) al inicio de **las 5 acciones** que devuelven un
   DTO al cliente: `deploy`, `play`, `cast`, `endTurn`, `abandon` (junto al reset de
   `defeats`).
3. **Se puebla** durante la acción, en los puntos de daño/KO.
4. **Viaja en el DTO** (ensamblado en `getStateDTO`).
5. **No se persiste**: no aparece en `serialize()`/`deserialize()`. Es información de
   una sola acción; el estado guardado no la necesita.

## Puntos de emisión (`services/game-service/src/services/GameService.ts`)

- **`cast`** (combate on-map, bucle de AoE): por cada ocupante dañado
  `push({ kind:'damage', pokemonId, hex, delta:-dmg })`; si cae KO,
  `push({ kind:'ko', pokemonId, hex })` **antes** de retirar la pieza del tablero.
- **`applyEndOfTurnEffects`** (fin de turno, efectos de terreno de todos los biomas;
  renombrado desde `applyLavaDamage` en T0.2): `damage` + `ko` por lava/pantano, y la vía
  `heal` (`delta` positivo) para curaciones de terreno. Ver
  [`16-TERRAIN_EFFECTS.md`](16-TERRAIN_EFFECTS.md).

Cualquier ticket que añada una fuente de daño/curación/estado (curación en hierba,
empuje, captura…) debe emitir su evento aquí, con el `kind` correspondiente.

## Niebla de guerra: filtrado por jugador

`getStateDTO(requestingPlayerId?)` ya censura los ocupantes **enemigos ocultos** de
quien pide el estado (los envía como `occupant: null`). El canal de eventos **respeta la
misma regla**: durante ese recorrido se recogen los `id` censurados (`censoredIds`) y se
**omiten los eventos cuyo `pokemonId` sea un enemigo aún oculto** del solicitante, para
que un número flotante nunca revele una pieza invisible.

- Un `damage` sobre un enemigo que **sigue oculto** tras el ataque → se ve para su
  **dueño**, se **oculta** para el rival.
- Un `ko` de una pieza ya retirada del tablero → se **conserva** para todos (su `id` ya
  no está entre los censurados; la pieza ha desaparecido, no hay nada que revelar).
- Eventos sin `pokemonId` → se conservan.

La difusión usa `broadcastPersonalized(..., getStateDTO(slot))`, así que el filtrado se
aplica **por destinatario**.

## Verificación

- Tests: [`services/game-service/test/turnEvents.test.ts`] — daño (delta<0, hex,
  pokemonId), KO (damage+ko), reset entre acciones, y el filtro de niebla (ataque a
  distancia a un oculto en hierba alta: lo ve el dueño, no el rival).
- `npm test` en game-service: 13/13 (incluye los 4 nuevos). `tsc --noEmit` limpio en los
  3 workspaces.

## Pendiente / cómo extenderlo

- **Consumo en el cliente:** T0.4 añadirá las primitivas (número flotante, flash, tween)
  que lean `state.events` en `GameController` y las animen sobre `#entities-layer`.
- **Nuevos `kind`:** cada ticket que introduzca una mecánica emite su evento en el punto
  del motor correspondiente (no hay que tocar el contrato, ya está definido).
