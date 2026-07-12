# Roadmap de Jugabilidad por Épicas y Tickets

> Reescritura completa del antiguo TICKETS_TACTICS. Convierte el diseño de
> [`11-GAME_DESIGN_ROADMAP.md`](11-GAME_DESIGN_ROADMAP.md) **y** el resto de la
> jugabilidad pendiente (obtención de Pokémon, progresión, evolución, social) en
> tickets listos para desarrollar. Alcance: **todo lo jugable**; la infraestructura
> pura (Vault/RabbitMQ/Redis/microservicios/ModSecurity/CI/pruebas de carga) queda
> fuera y se sigue en [`01-IMPLEMENTATION_PLAN.md`](01-IMPLEMENTATION_PLAN.md) /
> [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md).

## Cómo leer este documento

- El trabajo se agrupa en **épicas** (tareas padre). Cada épica contiene **tickets**.
- Cada ticket tiene: **Historia de usuario · Objetivos de desarrollo · Dudas
  resueltas · Criterios de aceptación · Investigación** (archivos/funciones a tocar,
  con líneas verificadas contra la rama `tactics`) **· Dependencias · Paralelizable**.
- Notación de dependencias: **[P]** = sin dependencias, arrancable en paralelo ·
  **→X** = depende del ticket X.
- **Todo ticket de motor (`engine/`) incluye tests unitarios** como criterio de
  aceptación (es lógica pura). Los de servicio/frontend se validan con smoke/e2e
  manual en local **y** online/arena vía Docker (`make up`).
- **Rama de trabajo:** todo se desarrolla sobre `tactics` (reconciliada en la Épica R);
  al cerrar cada épica se mergea `tactics → main`.

## Estado real verificado (correcciones al doc 11)

- **Divergencia de ramas (crítico):** `tactics` y `origin/main` divergieron desde
  `0edf5f7`. `origin/main` tiene 7 commits (~1172 líneas) que a `tactics` le faltan
  (menú de inventario vender/**regalar**, **cofres con pokéballs como botín**,
  acciones de objetos, `balls.ts`). El `main` **local** está viejo. Se reconcilia en
  la **Épica R** antes de nada.
- **Fase 3:** sigilo/emboscada ×1.5/niebla de guerra reales; falta revelar al oculto
  golpeado por AoE y el flash de revelado.
- **Fase 4:** ⚠️ el **daño de pantano es código muerto** (`terrainDamage` lo calcula
  pero `applyLavaDamage` solo se invoca con `'FIRE'`). Faltan fantasmas-atraviesan y
  curación de Planta en hierba.
- **Fase 5:** knockback/dash/carga inexistentes; `PokemonMove` no tiene esos campos.
- **Fase 6:** tamaños con infra (`getOccupiedHexes` da 7 hexes a `large`) pero todo
  Pokémon se crea `'medium'`; no hay trazado de línea hex ni redondeo cúbico.
- **Economía/progresión:** candies se ganan pero **nunca se gastan**;
  `owned_pokemon.level` **siempre 1** y el combate **ignora el nivel**; **evolución
  inexistente**; stub `OwnedPokemonModel.transfer` (captura) **sin llamadas**; loot
  pool son **200** Pokémon (#1-200), no 151; el equipo se envía **por nombre** (se
  pierde la instancia). "Survival" y "ENVIAR REGALO" son placeholders de UI sin backend.

## Decisiones de diseño transversales (dudas ya resueltas con el usuario)

| # | Decisión |
|---|----------|
| D1 | **Fantasmas** atraviesan a todos (aliados y enemigos); solo no pueden terminar en casilla ocupada. |
| D2 | **Knockback**: distancia por movimiento (1-3); **Large inmunes**; **colisión 10% maxHP**. |
| D3 | **Bodyblocking**: Large intercepta ataques `line` **y** ondas radiales (`radius`/`cone`) desde detrás (LoS por hex del AoE). |
| D4 | **Feedback visual completo**: números flotantes, flash de revelado "!", tweens de empuje/dash. |
| D5 | **Moves tácticos** etiquetados por **lista curada manual** (nombre PokeAPI → efecto). |
| D6 | **Tamaños de los 151**: auto por height/weight de PokeAPI + mapa de overrides. |
| D7 | **Ataques de 2 turnos (carga)**: **aplazados** como feature opcional. |
| D8 | **Local y Online/Arena** soportados desde el inicio en cada mecánica. |
| D9 | **Curación Planta en hierba alta**: **8% maxHP/turno**. |
| D10 | **Captura**: modo **Survival** (1J vs IA) con captura al derrotar, pérdida permanente y recuperación en tienda (10000 🪙); **+ robo PvP en Battle Royale**. |
| D11 | **Scope Gen 1**: clamp a **#1-151** como fuente única de verdad. |
| D12 | **Equipos por instancia** (`ownedId`): la partida usa nivel/stats/forma reales. |
| D13 | **Evolución**: **meta (hub) + in-match**, **fiel a PokeAPI** (nivel/piedra/intercambio). |
| D14 | **Niveles/XP**: XP en batalla + subida de nivel + **escalado de stats**. |
| D15 | **Draft eliminado**: todos los modos usan Pokémon propios. |
| D16 | **Objetos de evolución** (piedras, etc.) como **drops post-combate + compra en tienda** (reutiliza cofres). |
| D17 | **Evoluciones por intercambio**: se implementa un **sistema de intercambio** (Pokémon + objetos + monedas) que las dispara. |

**Defaults ajustables** (no bloquean, se afinan en desarrollo): curva de XP y escalado
de stats (lineal, cap nivel 100), tabla piedra→especie, nivel de captura (nace a
nivel 1), tasas de drop, umbrales de height/weight para tamaños.

---

# ÉPICA R — Reconciliación de ramas (PRE-REQUISITO)

> Bloquea todo. Trae a `tactics` el trabajo de economía/inventario de `origin/main`.

## 🎟️ TR.1 — Merge `origin/main` → `tactics`

**Historia de usuario:** Como equipo, quiero unificar el combate táctico (`tactics`)
con el trabajo de economía/inventario/regalos/cofres (`origin/main`) en una sola rama,
para construir el resto del roadmap sobre una base completa y sin duplicar trabajo.

**Objetivos de desarrollo:**
1. `git fetch origin` y `git merge origin/main` sobre `tactics`.
2. Resolver conflictos. Focos probables (tocados por ambos lados): `GameService.ts`
   (+167 líneas en main), `InventoryController.ts` (+111), `BoardView.ts` (+143),
   `MinimapView.ts` (+60), `HUDView.ts` (+52), `EconomyService.ts`, `MatchManager.ts`,
   `EntityView.ts`, `packages/shared` (`domain.ts`, `match.ts`, `index.ts` + `balls.ts` nuevo).
3. Actualizar el `main` local a `origin/main`.

**Dudas resueltas:** merge (no cherry-pick ni reimplementar); se trabaja sobre `tactics`.

**Criterios de aceptación:**
- [x] `make up` levanta el stack sin errores tras el merge (verificado por el usuario).
- [x] `npm run typecheck` limpio en todo el monorepo (3 workspaces).
- [x] Conviven: combate táctico + despliegue + sigilo (de `tactics`) con
      inventario/cofres-botín/regalar/subastas/gacha (de `origin/main`).
- [x] Se puede jugar una partida, abrir inventario, ver un cofre en el mapa y en el
      minimapa, y usar el menú contextual de inventario.

**Investigación:** `git log --oneline tactics..origin/main` (7 commits: `531d6f5`
vender/regalar, `f6a6134` cofres-botín, `68dba2b` cofres en minimapa, `d02338d` perf
arena, `a922f40`/`29c3635` fixes UI, `ca4b6cc` arena-cofre). Nuevos en main:
`packages/shared/src/balls.ts`, `services/frontend/src/views/hub/ContextMenu.ts`,
`services/game-service/src/routes/inventory.routes.ts`.

**Dependencias:** ninguna. **Paralelizable:** no (bloquea todo el resto).

### ✅ Resolución (lo realmente hecho) — desviación importante vs. el plan

El plan original asumía un **merge mecánico**. En la práctica apareció un **choque de
modelos de combate** que convirtió TR.1 en *merge + integración*:

- **`tactics`** = combate **on-map** (skillshot AoE en estado `'active'`, `GameService.cast`).
  **`origin/main`** = combate **interactivo antiguo** (estado `'combat'` + sub-estado
  `this.combat`, `ATACAR/HABILIDAD/OBJETO/HUIR`, `finalizeCombat`/`continueCombat`),
  con la **economía nueva de cofres/bolas injertada encima**.
- **Decisión (consultada con el usuario):** conservar el combate **on-map de tactics**
  (dirección del roadmap) y **re-enganchar la economía de cofres/bolas** a ese modelo,
  descartando el combate interactivo de main.

**Cambios de la resolución (7 ficheros en conflicto + 2 fixes de higiene):**
- `GameService.ts` (9 bloques): combate on-map de tactics; **injerto de 2 líneas** en el
  KO del `cast` (`this.addKo(caster.playerId)` + `this.dropBall(tile.occupant, tile.hex)`
  antes de retirar la pieza). La recogida de cofres ya estaba enganchada al movimiento
  (`collectFromTile`), y el KO por lava y el abandono/victoria ya soltaban bola / daban
  `rewards` (auto-merge). Constructor / `serialize` / `deserialize` **unen** ambos conjuntos
  de campos (`deploymentDeadline`/`reserve`/`deploymentZones` + `kos`/`chestRespawnTurn`).
- Backend `controllers/GameController.ts`: conservados `deploy`/`cast`/`forceStart`,
  eliminados `combatAction`/`combatContinue` (modelo viejo).
- `packages/shared/{index,match}.ts`: unión de exports/campos (`combat` + `balls`;
  despliegue + `kos`/`rewards`).
- Frontend `GameController.ts` y `BoardView.ts`: unión conservando la economía de bolas
  (`BALL_SPRITE`/`BALL_LABEL`/`BALL_TOP`/`BallKey`); eliminado `CombatAction` sin usar.
- Frontend `MinimapView.ts`: **reconstruido en 2 bucles** (sombreado de despliegue de
  tactics + marcadores de cofres/bolas de main); el auto-merge los había fundido en uno
  roto con la condición `if (!t.chest && !t.groundBall) continue`.
- Fix de higiene preexistente: `packages/shared/src/combat.ts` → `import type { Hex }`
  (bloqueaba el build del frontend bajo `verbatimModuleSyntax`; error de `tactics`, no del merge).

**Verificación:** `tsc` limpio en los 3 workspaces · tests game-service 9/9 y frontend 17/17 ·
las 4 imágenes Docker compilan (incl. build de producción del frontend) y los servicios
arrancan sin errores · `make up` funcionando (usuario). Revisión escéptica (manual, por
límite de sesión del agente): sin features perdidas, integridad de constructor confirmada
(solo 3 `new GameService(` internos), economía completamente alcanzable, sin handlers WS
huérfanos.

**Limpieza pendiente (no bloqueante, vestigios preexistentes):** tipos `combat_action`/
`combat_continue` en `packages/shared/src/ws.ts` (ya sin handler) y un comentario a
`CombatView` en `utils/theme.ts`.

---

# ÉPICA 0 — Fundaciones compartidas

> Desbloquean el feedback visual, la geometría y los efectos de fin de turno. →TR.1

## 🎟️ T0.1 — Canal de eventos de turno

**Historia de usuario:** Como desarrollador de frontend, quiero que el servidor
informe de qué pasó cada acción/turno (daños, curaciones, KOs, revelados,
empujes, capturas), para poder animarlo sin adivinar diffeando estados.

**Objetivos de desarrollo:**
1. Añadir a `packages/shared` un tipo `TurnEvent` (`{ kind: 'damage'|'heal'|'ko'|
   'reveal'|'knockback'|'dash'|'capture', pokemonId?, hex?, delta?, from?, to? }`) y un
   campo `events: TurnEvent[]` en el DTO de estado (`match.ts` / `getStateDTO`).
2. Poblar `events` durante `GameService.cast` (daños/KO), fin de turno (terreno) y
   futuras acciones. Vaciarlo por difusión.
3. Difundir en `GameActionService.apply` (ya hace `broadcastPersonalized`).

**Dudas resueltas:** feedback visual completo (D4); eventos estructurados, no diff de HP.

**Criterios de aceptación:**
- [ ] Cada respuesta/difusión de acción incluye `events` con lo ocurrido.
- [ ] Un ataque que hace 2 daños y 1 KO emite 3 eventos coherentes.
- [ ] `events` se reinicia entre acciones (no se acumula).

**Investigación:** `GameService.cast` (`GameService.ts:388-470`), fog en
`getStateDTO` (`GameService.ts:192-226`), difusión en `GameActionService.apply`
(`GameActionService.ts:55-74`), DTO en `packages/shared/src/match.ts`.

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T0.2 — Refactor de efectos de fin de turno + curación + fix SWAMP

**Historia de usuario:** Como jugador, quiero que el terreno aplique al final del
turno todos sus efectos (daño de lava, **daño de pantano** y curaciones), no solo la
lava, para que los biomas importen de verdad.

**Objetivos de desarrollo:**
1. Renombrar `applyLavaDamage()` → `applyEndOfTurnEffects()` y generalizarlo: recorrer
   ocupantes y aplicar `terrainDamage` según su bioma actual (no solo `'FIRE'`).
2. **Activar el daño de pantano** (hoy muerto: `terrainDamage` lo calcula pero nunca
   se invoca con `'SWAMP'`).
3. Permitir que `terrainDamage` devuelva **valores negativos = curación** (preparado
   para T2.2), aplicando `hp = clamp(hp - dmg, 0, maxHp)`.
4. Emitir eventos (T0.1) de daño/curación/KO.

**Dudas resueltas:** el pantano sí debe dañar (fix del código muerto); curación se
habilita aquí y la usa T2.2.

**Criterios de aceptación:**
- [ ] Un Pokémon (no Veneno/Acero) sobre pantano pierde HP al final del turno.
- [ ] La lava sigue escalando (×2 por turno consecutivo, `lavaTurns`).
- [ ] `terrainDamage` puede devolver negativo sin romper nada (HP no supera `maxHp`).
- [ ] Tests unitarios del motor cubren lava (escalado), pantano y curación.

**Investigación:** `applyLavaDamage` (`GameService.ts:518-540`), `terrainDamage`
(`engine/environment.ts:67-85`), llamada desde `endTurn` (`GameService.ts:492`).

**Dependencias:** ninguna (tras TR.1). Coordina con T0.1 para emitir eventos.
**Paralelizable:** sí.

## 🎟️ T0.3 — Geometría hexagonal: `hexRound` + `hexLineDraw`

**Historia de usuario:** Como desarrollador del motor, quiero trazar la línea recta
real entre dos hexágonos, para implementar línea de visión, bodyblocking y direcciones
de empuje/dash de forma correcta.

**Objetivos de desarrollo:**
1. Añadir a `engine/hex.ts`: conversión axial↔cube, `hexRound(fractional)` (redondeo
   cúbico) y `hexLineDraw(a, b): Hex[]` (interpolación + `hexRound`, línea punto a punto).
2. Tests unitarios exhaustivos (líneas rectas, diagonales, casos degenerados a==b).

**Dudas resueltas:** hoy no existe trazado de línea real; `getLineArea` de shared es un
rayo en una de 6 direcciones, no sirve para LoS punto a punto.

**Criterios de aceptación:**
- [ ] `hexLineDraw(a, b)` devuelve la secuencia contigua de hexes de A a B, ambos incluidos.
- [ ] Tests cubren líneas en varias direcciones y longitudes.

**Investigación:** `engine/hex.ts` (exports actuales: `createHex`, `hexAdd`,
`hexSubtract`, `hexDistance`, `hexNeighbor(s)`, `hexEqual`; sin conversión cube ni
line-draw). Referencia de AoE existente: `packages/shared/src/combat.ts`.

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T0.4 — Primitivas de feedback visual (frontend)

**Historia de usuario:** Como jugador, quiero ver animaciones claras (números que
flotan, destellos, deslizamientos) de lo que ocurre en el tablero, para entender el
combate de un vistazo.

**Objetivos de desarrollo:**
1. Crear utilidades frontend reutilizables sobre `#entities-layer`: componente de
   **número flotante** (`-5` rojo / `+10` verde con animación CSS), **flash/"!"** de
   aparición, y **helper de tween** de posición (desplazar un sprite de hex a hex).
2. Consumir el `events` del DTO (T0.1) en `GameController.onRealtimeMessage`/`applyMatchState`
   para disparar estas animaciones.

**Dudas resueltas:** feedback visual completo (D4). Hoy solo hay un `transition` CSS de
0.1s en `EntityView` y ningún sistema de números flotantes/flash/tween.

**Criterios de aceptación:**
- [ ] Existe una API frontend para "mostrar número flotante en hex", "flash en hex" y
      "tween de sprite de A a B".
- [ ] Un evento `damage` del servidor produce un número rojo sobre el objetivo.

**Investigación:** `EntityView.ts` (render de sprites, transición L59/96/118),
`GameController.ts` (`applyMatchState` L322-357, `onRealtimeMessage` L239-253),
`GameState.pokeGifs`. Nuevo util en `services/frontend/src/utils/`.

**Dependencias:** →T0.1. **Paralelizable:** no (necesita el canal de eventos).

---

# ÉPICA 1 — Completar Sigilo (Fase 3)

## 🎟️ T1.1 — Revelación por daño AoE (backend)

**Historia de usuario:** Como jugador, quiero que un Pokémon oculto en hierba alta se
revele si lo alcanza un ataque de área, para que el sigilo no sea inmune al fuego a ciegas.

**Objetivos de desarrollo:**
1. En el bucle de daño de `GameService.cast` (~L435-458), tras dañar a un
   `tile.occupant` con `isHidden === true`, ponerlo `isHidden = false`, registrar log
   ("👁️ ¡X descubierto!") y emitir evento `reveal` (T0.1).
2. No afecta al multiplicador de emboscada del atacante (se sigue evaluando por su
   `isHidden` al inicio del cálculo).

**Dudas resueltas:** el flash visual va en T1.2 (feedback completo, D4).

**Criterios de aceptación:**
- [ ] Un AoE sobre hierba con un oculto enemigo en el radio lo revela (pasa a visible
      en el DTO del rival).
- [ ] La emboscada ×1.5 solo aplica si el **atacante** estaba oculto al lanzar.
- [ ] Test unitario/integración del revelado por daño.

**Investigación:** `GameService.cast` bucle de daño (`GameService.ts:435-458`, KO en
452), `updateStealthVisibility` (`GameService.ts:343-385`), emboscada en
`engine/combat.ts:27`.

**Dependencias:** ninguna (mejor con T0.1 para el evento). **Paralelizable:** sí.

## 🎟️ T1.2 — Flash de revelado "!" (frontend)

**Historia de usuario:** Como jugador, quiero un destello/"!" estilo Metal Gear cuando
un enemigo oculto aparece de golpe, para notar la emboscada revelada.

**Objetivos de desarrollo:**
1. Al recibir un evento `reveal` (o cuando un sprite enemigo pasa de ausente→presente),
   reproducir el flash/"!" de T0.4 sobre su hex.

**Dudas resueltas:** animación "!" (D4).

**Criterios de aceptación:**
- [ ] Al revelarse un enemigo, se ve el flash/"!" antes de asentar el sprite.

**Investigación:** `EntityView.ts` (aparición de nodos, sin animación de entrada hoy),
util de T0.4.

**Dependencias:** →T1.1, →T0.4. **Paralelizable:** no.

---

# ÉPICA 2 — Pasivas y Terreno Avanzado (Fase 4)

## 🎟️ T2.1 — Fantasmas atraviesan unidades (backend)

**Historia de usuario:** Como estratega, quiero que mis Pokémon Fantasma atraviesen a
otras unidades al moverse, para posicionarlos de forma etérea.

**Objetivos de desarrollo:**
1. En `getMoveOptions` (`movement.ts:71-83`), si `pokemon.type === 'GHOST'`, no cortar
   el Dijkstra al encontrar un ocupante (seguir expandiendo).
2. Excluir los hexes ocupados como **destino final** válido (no puede terminar encima).
3. Mantener el marcado de enemigos adyacentes como objetivos de ataque.

**Dudas resueltas (D1):** paso libre por todos (aliados y enemigos), sin ataque de
oportunidad; solo no puede terminar en casilla ocupada.

**Criterios de aceptación:**
- [ ] Un Fantasma calcula rutas atravesando montañas y otras piezas.
- [ ] No puede terminar su movimiento en una casilla ocupada.
- [ ] Un no-Fantasma sigue bloqueado por ocupantes (sin regresión).
- [ ] Tests del motor para ambos casos.

**Investigación:** `getMoveOptions` occupant-skip (`movement.ts:71` check, `:83`
`continue`), tipos con coste 1 ya en `environment.ts:31` (FLYING/GHOST).

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T2.2 — Curación de Planta en hierba + daño de pantano visible

**Historia de usuario:** Como jugador con Pokémon de Planta, quiero que se regeneren al
acabar el turno sobre hierba alta, y que el pantano envenene a quien no sea Veneno/Acero.

**Objetivos de desarrollo:**
1. En `terrainDamage`, si `terrain === 'TALL_GRASS' && pokemon.type === 'GRASS'`,
   devolver curación negativa = **8% de maxHp** (D9).
2. Confirmar el daño de pantano ya activado en T0.2; emitir eventos heal/damage (T0.1).
3. Logs apropiados ("♻️ X se regenera", "☠️ X sufre el pantano").

**Dudas resueltas (D9):** 8% maxHP/turno de curación.

**Criterios de aceptación:**
- [ ] Un Planta sobre hierba alta recupera ~8% maxHp al final de su turno (sin pasar maxHp).
- [ ] Un no-Veneno/Acero pierde HP en pantano.
- [ ] Tests del motor para curación y pantano.

**Investigación:** `terrainDamage` (`environment.ts:67-85`, TALL_GRASS cae a `return 0`
en L84), fin de turno de T0.2.

**Dependencias:** →T0.2. **Paralelizable:** no.

## 🎟️ T2.3 — Números flotantes de daño/curación (frontend)

**Historia de usuario:** Como jugador, quiero ver los números de daño y curación sobre
los Pokémon, en combate y al final del turno, para seguir lo que pasa sin mirar el log.

**Objetivos de desarrollo:**
1. Consumir eventos `damage`/`heal` (T0.1) y pintar el número flotante (T0.4) sobre el
   sprite correspondiente, tanto en `cast` como en efectos de fin de turno.

**Dudas resueltas:** feedback completo (D4).

**Criterios de aceptación:**
- [ ] Al recibir daño de un ataque, aparece `-N` rojo sobre el objetivo.
- [ ] Al curarse en hierba, aparece `+N` verde al final del turno.

**Investigación:** util de T0.4, `EntityView`/`GameController` para localizar el hex→pixel.

**Dependencias:** →T0.1, →T0.2, →T0.4. **Paralelizable:** no.

---

# ÉPICA 3 — Movimientos Tácticos (Fase 5)

## 🎟️ T3.1 — Empuje / Knockback (backend)

**Historia de usuario:** Como jugador táctico, quiero ataques que empujen al enemigo
hacia atrás, para descolocarlo, alejarlo de un aliado o estamparlo contra un obstáculo.

**Objetivos de desarrollo:**
1. Extender `PokemonMove` (`domain.ts`) con `knockback?: number` (1-3).
2. Mapa curado manual (D5): nombres de moves PokeAPI → `knockback` (ej. `roar`,
   `whirlwind`, `dragon-tail`, `bulldoze`…), aplicado en la curación de moves
   (`PokemonService`).
3. En `GameService.cast`, tras el daño, si `move.knockback`, calcular la dirección hex
   (vector atacante→víctima) y mover al defensor N hexes con `board.moveOccupant`.
   **Large inmunes** (no se mueven). Si choca con obstáculo/pieza/borde, se detiene y
   recibe **10% maxHp** de colisión. Emitir evento `knockback` (T0.1).

**Dudas resueltas (D2):** distancia por movimiento (1-3); Large inmunes; colisión 10%.

**Criterios de aceptación:**
- [ ] Un ataque con knockback empuja al defensor su nº de hexes en la dirección correcta.
- [ ] Si choca con obstáculo/pieza/borde, se detiene y recibe 10% maxHp.
- [ ] Un defensor `large` no se mueve por empuje.
- [ ] Tests del motor: dirección, tope por colisión, inmunidad large.

**Investigación:** `PokemonMove` (`domain.ts:39-58`), `moveOccupant` (colisión atómica,
`board.ts:70-102`), `getOccupiedHexes` (`board.ts:36-41`), `cast` (`GameService.ts:388-470`),
`getCuratedMoves`/`toMove` (`PokemonService.ts:199-228`).

**Dependencias:** →T0.1 (evento); recomendable →T0.3 (dirección). **Paralelizable:** parcial.

## 🎟️ T3.2 — Deslizamiento de empuje (frontend)

**Historia de usuario:** Como jugador, quiero ver al Pokémon empujado deslizarse hacia
atrás, para percibir el impacto.

**Objetivos de desarrollo:** consumir evento `knockback` y animar el tween (T0.4) del
defensor de su hex origen al destino.

**Criterios de aceptación:**
- [ ] El defensor se desliza (no salta) a su nueva casilla tras el empuje.

**Investigación:** util tween de T0.4, `EntityView`.

**Dependencias:** →T3.1, →T0.4. **Paralelizable:** no.

## 🎟️ T3.3 — Dash / Desplazamiento-ataque (backend)

**Historia de usuario:** Como jugador, quiero ataques que me lancen en línea recta
hacia el enemigo dañando a lo que atraviese, para cerrar distancias con estilo.

**Objetivos de desarrollo:**
1. `PokemonMove.dash?: boolean` + mapa curado (D5) (ej. `extreme-speed`, `quick-attack`).
2. Nueva variante en el `GameAction` union (`GameActionService.ts:7-13`) o reutilizar
   `cast` con flag; calcular la línea atacante→objetivo (`hexLineDraw`, T0.3), mover al
   atacante a la casilla adyacente al objetivo y aplicar daño a lo atravesado.
3. Emitir evento `dash` (T0.1).

**Dudas resueltas (D5):** dash por lista curada.

**Criterios de aceptación:**
- [ ] Un ataque dash mueve al atacante junto al objetivo y daña a los atravesados.
- [ ] Validación de turno/propiedad/alcance como el resto de acciones.
- [ ] Tests del motor de la trayectoria y el daño en línea.

**Investigación:** `GameAction` union y `run` (`GameActionService.ts:7-13,30-46`),
`cast` (`GameService.ts:388-470`), `hexLineDraw` (T0.3).

**Dependencias:** →T0.3, →T0.1. **Paralelizable:** parcial.

## 🎟️ T3.4 — Deslizamiento de dash (frontend)

**Historia de usuario:** Como jugador, quiero ver el desplazamiento del dash animado.

**Objetivos de desarrollo:** consumir evento `dash` y animar el tween del atacante.

**Criterios de aceptación:**
- [ ] El atacante se desliza por la línea hasta junto al objetivo.

**Dependencias:** →T3.3, →T0.4. **Paralelizable:** no.

## 🎟️ (DIFERIDO) T3.5 — Ataques de 2 turnos / carga (Vuelo, Excavar)

**Estado:** **feature opcional, aplazada** (D7) — la más compleja (estado intermedio
persistente + interacción con fog e IA). Se documenta el diseño (campo
`Pokemon.chargingMove`, invulnerabilidad, acción de aterrizaje, UI de carga) pero **no
se desarrolla en este lote**. Retomar tras estabilizar el resto de la Fase 5.

---

# ÉPICA 4 — Tamaños, Línea de Visión y Bodyblocking (Fase 6)

## 🎟️ T4.1 — Tamaño por especie para los 151 (backend)

**Historia de usuario:** Como jugador, quiero que cada especie tenga su tamaño real
(Snorlax gigante, Pikachu pequeño), para que el tamaño tenga peso táctico.

**Objetivos de desarrollo:**
1. En `PokemonService.getTemplate`, derivar `size` de `height`/`weight` de PokeAPI
   (umbrales ajustables) en vez del `'medium'` hardcodeado (L119/L135).
2. Mapa de **overrides** para excepciones (ej. Onix alto pero fino; Snorlax pesado).
3. Cubre los 151 (D6, D11).

**Dudas resueltas (D6):** auto por height/weight + overrides.

**Criterios de aceptación:**
- [ ] Snorlax/Lapras/Onix salen `large`; Pikachu/Clefairy/etc. `small`; el grueso `medium`.
- [ ] Un `large` ocupa 7 hexes en partida (ya soportado por `getOccupiedHexes`).
- [ ] Tests de la clasificación (con casos de override).

**Investigación:** `getTemplate` size (`PokemonService.ts:119,135`), `getOccupiedHexes`
(`board.ts:36-41`), `canEnter` large→montaña (`environment.ts:57-59`), tipo
`PokemonSize` (`domain.ts:29-30`).

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T4.2 — Render de Pokémon Large (frontend)

**Historia de usuario:** Como jugador, quiero ver a los Pokémon grandes más grandes y
las 7 casillas que ocupan resaltadas, para leer el tablero.

**Objetivos de desarrollo:**
1. `EntityView`: escalar el sprite (~2×) cuando `size === 'large'` (hoy `sSize` es fijo).
2. `BoardView`: highlight de los 7 hexes ocupados por un large.

**Criterios de aceptación:**
- [ ] Un large se ve claramente mayor y su huella (7 hexes) está resaltada.

**Investigación:** `EntityView.ts` (`sSize = HEX_SIZE*1.5*zoom`, no lee `size`),
`BoardView.ts` (sin concepto de huella multi-hex).

**Dependencias:** →T4.1. **Paralelizable:** no.

## 🎟️ T4.3 — Línea de visión + Bodyblocking (backend)

**Historia de usuario:** Como defensor, quiero usar a mis Pokémon grandes como muro
para bloquear proyectiles y ondas y proteger a los que están detrás.

**Objetivos de desarrollo:**
1. Al resolver el daño de un ataque en `cast`, para cada hex del AoE trazar la línea
   (`hexLineDraw`, T0.3) desde el atacante; si un hex intermedio está ocupado por un
   `large`, el proyectil/onda **impacta en él** y no llega a lo que hay detrás.
2. Aplica a ataques `line` **y** a radiales/cono desde detrás del coloso (D3).
3. Un ataque `line` no puede seleccionar como objetivo válido a quien esté tras un large.

**Dudas resueltas (D3):** bloquea línea Y radiales-detrás (LoS por hex del AoE).

**Criterios de aceptación:**
- [ ] Un Hiperrayo contra alguien tras un `large` impacta en el `large`.
- [ ] Una explosión radial no daña a los hexes en sombra del `large`.
- [ ] Tests del motor de LoS/oclusión para line y radius/cone.

**Investigación:** `cast` daño (`GameService.ts:435-458`), `calculateAoE`
(`packages/shared/src/combat.ts:94-102`, sin conocimiento de ocupantes → el filtrado va
en el llamador game-service), `hexLineDraw` (T0.3), `getOccupiedHexes` (`board.ts:36-41`).

**Dependencias:** →T0.3, →T4.1. **Paralelizable:** no.

## 🎟️ T4.4 — Feedback de intercepción (frontend)

**Historia de usuario:** Como jugador, quiero ver que el proyectil impacta en el muro y
no en mi objetivo, para entender por qué no hice daño.

**Objetivos de desarrollo:** al recibir el resultado, mostrar el impacto sobre el `large`
interceptor (flash/número) en vez de sobre el objetivo original.

**Criterios de aceptación:**
- [ ] Un ataque bloqueado muestra el impacto en el coloso.

**Dependencias:** →T4.3, →T0.4. **Paralelizable:** no.

---

# ÉPICA 5 — Scope Gen 1 (151) y catálogo de especies

## 🎟️ T5.1 — Clamp a #1-151 (fuente única de verdad)

**Historia de usuario:** Como jugador de la v1, quiero que el juego use exactamente los
151 Pokémon de Gen 1, de forma consistente en tienda, starters y todo.

**Objetivos de desarrollo:**
1. Regenerar `lootPool.ts` a los 151 (hoy son 200, #1-200 con Gen 2).
2. Validar/limitar `PokemonService.getTemplate` a Gen 1 (rechazar fuera de rango).
3. Unificar los pools (tienda/starters) contra esa fuente única.

**Dudas resueltas (D11):** clamp a #1-151.

**Criterios de aceptación:**
- [ ] Ningún flujo concede/instancia un Pokémon fuera de #1-151.
- [ ] Tienda/starters/loot usan la misma lista de 151.
- [ ] Tests de los límites.

**Investigación:** `lootPool.ts` (`LOOT_POOL_TIERS`, 200 estáticos),
`PokemonService.getTemplate` (`PokemonService.ts:97-140`, sin límite de dex),
`loot.ts` (`BALLS`, `rollTier`, `pickFromTier`), `MatchManager` `STARTER_POOL`.

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T5.2 — Catálogo de especies: cadenas de evolución de PokeAPI

**Historia de usuario:** Como sistema, quiero conocer para cada especie su evolución
(disparador y forma destino), para poder evolucionar fielmente a Pokémon.

**Objetivos de desarrollo:**
1. Extender `PokemonService` para consultar `/pokemon-species/{name}` y
   `/evolution-chain/{id}` (hoy solo se usa `/pokemon/{name}` y `/move/{name}`).
2. Persistir por especie: `{ trigger: 'level'|'stone'|'trade', item?, minLevel?, evolvesTo }`
   en una tabla/columna nueva (junto a `pokemons`).

**Dudas resueltas (D13):** fiel a PokeAPI.

**Criterios de aceptación:**
- [ ] Para cualquier especie de Gen 1 se puede consultar su evolución y disparador.
- [ ] Tests con casos: nivel (Charmander), piedra (Vulpix/Eevee), intercambio (Kadabra).

**Investigación:** `PokemonService.getTemplate` (`PokemonService.ts:97-140`), tablas
`pokemons`/`moves`/`pokemon_moves` (`db.ts:36-140`), sin datos de evolución hoy.

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

---

# ÉPICA 6 — Progresión: Niveles, XP y equipos por instancia

## 🎟️ T6.1 — XP y subida de nivel (backend)

**Historia de usuario:** Como entrenador, quiero que mis Pokémon ganen experiencia
combatiendo y suban de nivel, para progresar con mi colección.

**Objetivos de desarrollo:**
1. Añadir columna `xp` a `owned_pokemon` (hoy solo `level`, siempre 1).
2. Otorgar XP por KO/victoria (engancha donde ya se reparten monedas:
   `EconomyService.awardForResult` / fin de partida), atribuyendo a la instancia
   (`ownedId`) — requiere el mapeo de T6.3 para saber qué instancia participó.
3. Subir de nivel según curva (default lineal, cap 100, ajustable).

**Dudas resueltas (D14):** XP en batalla + subida de nivel.

**Criterios de aceptación:**
- [ ] Un Pokémon que combate y hace KOs gana XP y puede subir de nivel (persistente).
- [ ] Tests de la curva de XP y el level-up.

**Investigación:** `owned_pokemon` (`db.ts:120-129`, `level` default 1 nunca mutado),
`OwnedPokemonModel` (sin `xp`, `grantMany` fija level=1), `EconomyService.awardForResult`
(`EconomyService.ts:19-39`, usa `slotUserMap`), `defeats` (`GameService.ts:452`).

**Dependencias:** ninguna para el nivel/XP base; la atribución fina depende de T6.3.
**Paralelizable:** sí (parte).

## 🎟️ T6.2 — Escalado de stats por nivel

**Historia de usuario:** Como jugador, quiero que un Pokémon de nivel alto sea
notablemente más fuerte que uno recién obtenido.

**Objetivos de desarrollo:**
1. Que la creación de la pieza de partida y el combate usen el nivel: escalar
   hp/atk/def por nivel (fórmula ajustable) en `effectiveAtk`/`effectiveDef`/creación.

**Dudas resueltas (D14):** escalado de stats.

**Criterios de aceptación:**
- [ ] Dos instancias de la misma especie a niveles distintos tienen stats distintos en partida.
- [ ] Tests del escalado.

**Investigación:** `computeMoveDamage` (`engine/combat.ts:14-30`),
`effectiveAtk/Def` (`environment.ts:7-22`), creación de pieza (`MatchManager` `build`
L101-106 / `buildPokemon` L302-304, hoy `level:1`).

**Dependencias:** →T6.1. **Paralelizable:** no.

## 🎟️ T6.3 — Equipos por instancia (`ownedId`)

**Historia de usuario:** Como jugador, quiero llevar a la partida MIS Pokémon concretos
(con su nivel/forma), no plantillas genéricas a nivel 1.

**Objetivos de desarrollo:**
1. `SubmitTeamRequest` pasa a enviar **`ownedId[]`** (hoy `string[]` de nombres).
2. `resolveOwnedTeams`/`addToArena` cargan la instancia real (nivel/stats/forma) desde
   `owned_pokemon`, no solo el nombre a nivel 1.
3. Añadir `ownedId` al engine `Pokemon` (`domain.ts`) para arrastrar la identidad de la
   instancia (necesario también para captura, Épica 8).
4. Pickers frontend (`OwnedTeamPickerView`) ya seleccionan por id: enviar el id, no el nombre.

**Dudas resueltas (D12):** equipos por instancia con stats reales.

**Criterios de aceptación:**
- [ ] El equipo se valida y construye por `ownedId`; la partida refleja nivel/stats/forma reales.
- [ ] La validación de propiedad sigue siendo autoritativa (solo tus instancias).
- [ ] Tests de `resolveOwnedTeams` con instancias de distinto nivel.

**Investigación:** `SubmitTeamRequest`/`DRAFT_TEAM_SIZE` (`packages/shared/src/lobby.ts`),
`RoomService.submitTeam` (validación por nombre, `RoomService.ts:145-191`),
`resolveOwnedTeams` (`MatchManager.ts:190-204`), `build`/`buildPokemon` (level:1),
`OwnedTeamPickerView` (selecciona por id, envía nombres, L114-123), engine `Pokemon`
(`domain.ts:60-85`, sin `ownedId`).

**Dependencias:** →T6.2. **Paralelizable:** no.

## 🎟️ T6.4 — UI de nivel/XP (frontend)

**Historia de usuario:** Como jugador, quiero ver el nivel y el progreso de XP de mis
Pokémon en el inventario y en la partida.

**Objetivos de desarrollo:** mostrar nivel/barra de XP en `InventoryView`,
`PokemonDetailModal` y HUD de combate.

**Criterios de aceptación:**
- [ ] El inventario y la ficha muestran nivel y progreso; el HUD muestra el nivel en partida.

**Investigación:** `InventoryView.ts`, `PokemonDetailModal.ts`, `HUDView.ts`.

**Dependencias:** →T6.2. **Paralelizable:** no.

---

# ÉPICA 7 — Eliminar Draft, unificar a Pokémon propios

## 🎟️ T7.1 — Todos los modos usan equipos propios

**Historia de usuario:** Como jugador, quiero jugar TODOS los modos con mis propios
Pokémon (los que consigo y evoluciono), no con un roster de draft genérico.

**Objetivos de desarrollo:**
1. Eliminar el camino de draft: `ROSTER_NAMES`, `resolveTeams`, `getRoster`, `DraftView`
   y la ruta `/api/game/roster`.
2. `OWNED_TEAM_MODES` pasa a ser **todos** los modos; la validación por inventario
   (`RoomService.submitTeam`) aplica siempre.
3. Ajustar `MatchManager.createGame` (branch draft/owned, L267-269), `startMatch`
   (local, hoy siempre draft) y el flujo local.

**Dudas resueltas (D15):** draft eliminado.

**Criterios de aceptación:**
- [ ] Ningún modo usa el roster de draft; todos exigen equipo del inventario propio.
- [ ] 1v1/2v2 locales y online funcionan con equipos propios.
- [ ] Tests de la unificación (no queda referencia viva a `resolveTeams`/roster).

**Investigación:** `MatchManager` (`ROSTER_NAMES` L32-44, `getRoster` L79, `resolveTeams`
L151-184, `createGame` L261-292, `startMatch` L216-241), `OWNED_TEAM_MODES`
(`lobby.ts:15`), `DraftView.ts`.

**Dependencias:** →T6.3. **Paralelizable:** no.

---

# ÉPICA 8 — Captura ("tazos")

## 🎟️ T8.1 — Modo Survival (1 jugador vs IA)

**Historia de usuario:** Como jugador en solitario, quiero un modo Survival contra la IA
donde capturo lo que derroto, para construir mi colección jugando.

**Objetivos de desarrollo:**
1. Nuevo `GameMode 'survival'` (shared) y su flujo (single-player vs IA existente).
2. Habilitar la UI ya esbozada: botón "SURVIVAL MODE" (`SinglePlayerMenuView`, hoy
   `disabled`).

**Dudas resueltas (D10):** Survival = 1J vs IA con captura.

**Criterios de aceptación:**
- [ ] Se puede iniciar una partida Survival vs IA desde el menú de un jugador.
- [ ] Tests del arranque/flujo básico.

**Investigación:** `GameMode` (`lobby.ts:12`), `SinglePlayerMenuView.ts:35` (botón
disabled), IA local (`controllers/botStrategy.ts`, `aiDraft.ts`).

**Dependencias:** ninguna (tras TR.1). **Paralelizable:** sí.

## 🎟️ T8.2 — Captura al derrotar (backend)

**Historia de usuario:** Como jugador, quiero que al derrotar a un Pokémon rival pase a
mi inventario, como en una partida de tazos.

**Objetivos de desarrollo:**
1. Arrastrar `ownedId` en la pieza del engine (de T6.3) y el mapeo `slot→userId`
   (`RoomService.slotUserMap`).
2. Incluir `victimOwnedId` en los registros de `defeats` (`GameService.cast:452` y KO por
   lava/fin de turno).
3. Al resolver, llamar `OwnedPokemonModel.transfer(victimOwnedId, ganadorUserId)`
   (`acquired_via='capture'`, 🎯). Aplica en Survival (vs IA/wild) y BR (ver T8.4).
4. Emitir evento `capture` (T0.1).

**Dudas resueltas (D10):** captura al derrotar; el stub `transfer` ya existe sin uso.

**Criterios de aceptación:**
- [ ] Derrotar a un Pokémon en Survival lo añade a tu inventario (🎯).
- [ ] La transferencia usa la instancia correcta (`ownedId`), no el nombre.
- [ ] Tests de la transferencia y de la resolución de `slot→user→ownedId`.

**Investigación:** `OwnedPokemonModel.transfer` (`OwnedPokemonModel.ts:67-75`, 0 llamadas),
`defeats` (`GameService.ts:183,452` solo slots), `slotUserMap` (`RoomService.ts:245-249`),
`EconomyService.awardForResult` (punto natural de enganche, `EconomyService.ts:19-39`),
engine `Pokemon` (sin `ownedId` hoy).

**Dependencias:** →T6.3, →T8.1. **Paralelizable:** no.

## 🎟️ T8.3 — Pérdida permanente + recuperar en tienda (Survival)

**Historia de usuario:** Como jugador de Survival, acepto perder de verdad a mis
Pokémon caídos, pero quiero poder recuperar uno pagando, para no perderlo para siempre.

**Objetivos de desarrollo:**
1. En Survival, un Pokémon propio derrotado se retira del inventario (pérdida real).
2. Opción "RECUPERA UN POKÉMON" en tienda por **10000 🪙** (habilitar botón
   `ShopMenuView`, hoy `disabled`), que restaura el último perdido en Survival.

**Dudas resueltas (D10):** pérdida permanente + recuperación 10000.

**Criterios de aceptación:**
- [ ] Perder un Pokémon en Survival lo quita del inventario.
- [ ] La tienda permite recuperarlo por 10000 (con saldo suficiente).
- [ ] Tests de pérdida y recuperación.

**Investigación:** `ShopMenuView.ts:53` (botón disabled), `ShopController`/`shop.routes.ts`,
`OwnedPokemonModel`, `UserModel.addCoins`.

**Dependencias:** →T8.2. **Paralelizable:** no.

## 🎟️ T8.4 — Robo PvP en Battle Royale

**Historia de usuario:** Como jugador hardcore de Battle Royale, quiero que al derrotar
al Pokémon de otro jugador me lo quede, para que el modo tenga riesgo real.

**Objetivos de desarrollo:**
1. Aplicar la transferencia de T8.2 en modo `br`: el ganador de un KO roba la instancia
   del rival (permanente).

**Dudas resueltas (D10):** robo PvP solo en Battle Royale.

**Criterios de aceptación:**
- [ ] En BR, un KO transfiere la instancia derrotada al vencedor.
- [ ] En 1v1/2v2/arena NO hay robo (salvo lo definido para arena si aplica).
- [ ] Tests del robo en BR y no-robo en el resto.

**Investigación:** misma ruta que T8.2 filtrando por `gameMode === 'br'`;
`EconomyService.awardForResult`, `slotUserMap`.

**Dependencias:** →T8.2. **Paralelizable:** no.

## 🎟️ T8.5 — Feedback de captura/robo (frontend)

**Historia de usuario:** Como jugador, quiero una señal clara (🎯/animación) cuando
capturo o me roban un Pokémon.

**Objetivos de desarrollo:** consumir evento `capture` y animar; el inventario ya marca
🎯 los `acquired_via==='capture'`.

**Criterios de aceptación:**
- [ ] Al capturar/robar, hay feedback visible en partida y el Pokémon aparece con 🎯 en inventario.

**Investigación:** `InventoryView.ts:94` (tag 🎯 ya existe), util de T0.4.

**Dependencias:** →T8.2, →T0.4. **Paralelizable:** no.

---

# ÉPICA 9 — Evolución (meta + in-match, fiel a PokeAPI)

## 🎟️ T9.1 — Resolución de evolución por especie

**Historia de usuario:** Como sistema, dado un Pokémon y su contexto (nivel/objeto),
quiero saber si evoluciona y a qué forma, para aplicarlo.

**Objetivos de desarrollo:** función que, usando el catálogo de T5.2, resuelve
`{ puedeEvolucionar, formaDestino, requisito }` para una instancia.

**Dudas resueltas (D13):** fiel a PokeAPI (nivel/piedra/intercambio).

**Criterios de aceptación:**
- [ ] Resuelve correctamente evolución por nivel, por piedra y marca las de intercambio.
- [ ] Tests con Charmander (nivel), Vulpix (piedra), Kadabra (intercambio).

**Investigación:** catálogo de T5.2; `PokemonService`.

**Dependencias:** →T5.2. **Paralelizable:** no.

## 🎟️ T9.2 — Objetos de evolución como drops + tienda

**Historia de usuario:** Como jugador, quiero conseguir piedras evolutivas jugando (drops)
y comprándolas, para evolucionar a mis Pokémon.

**Objetivos de desarrollo:**
1. Catálogo de objetos de evolución de Gen 1 (piedras Fuego/Agua/Trueno/Hoja/Lunar y las
   necesarias) en `owned_items`.
2. **Reutilizar el sistema de cofres-botín** (venido de `origin/main` en TR.1) para
   dropearlos en el mapa + compra en tienda.

**Dudas resueltas (D16):** drops post-combate + tienda; reutiliza cofres.

**Criterios de aceptación:**
- [ ] Las piedras aparecen como botín en cofres y en la tienda.
- [ ] Se acumulan en el inventario de objetos.
- [ ] Tests del catálogo/otorgamiento.

**Investigación:** `owned_items`/`ItemModel`, sistema de cofres (post-TR.1: `f6a6134`),
`ShopController`.

**Dependencias:** →T5.2, →TR.1. **Paralelizable:** parcial.

## 🎟️ T9.3 — Evolución meta en el hub

**Historia de usuario:** Como jugador, quiero evolucionar a mis Pokémon desde el
inventario cuando cumplen el requisito (nivel o piedra), de forma permanente.

**Objetivos de desarrollo:**
1. `OwnedPokemonModel.evolve(id, nuevaForma)` (`UPDATE ... SET name=?`), asegurando la
   plantilla destino vía `getTemplate`.
2. Acción en `InventoryController` + ruta; botón "Evolucionar" en `InventoryView`/
   `PokemonDetailModal` cuando `T9.1` lo permita (consume piedra/valida nivel).

**Dudas resueltas (D13):** evolución meta persistente.

**Criterios de aceptación:**
- [ ] Un Pokémon que cumple requisito puede evolucionar desde el inventario (persistente).
- [ ] Consume la piedra correspondiente / valida el nivel.
- [ ] Tests del flujo meta.

**Investigación:** `OwnedPokemonModel`, `InventoryController`/`inventory.routes.ts`
(ampliados en TR.1), `InventoryView.ts`, `PokemonDetailModal.ts`.

**Dependencias:** →T9.1, →T9.2, →T6.1. **Paralelizable:** no.

## 🎟️ T9.4 — Evolución in-match

**Historia de usuario:** Como jugador, quiero evolucionar a un Pokémon durante la
batalla (gastando recursos), para dar la vuelta a un combate.

**Objetivos de desarrollo:**
1. Nueva acción `evolve` en el `GameAction` union → `GameService.evolve(from)`:
   valida requisito, consume candies (`this.resources`, hoy **nunca se gastan**) y/o
   nivel, cambia `name`/stats de la pieza y emite evento; el sprite se refresca solo
   (lookup por nombre en frontend).
2. Persistir la forma si procede (D13: ambos flujos).

**Dudas resueltas (D13):** evolución in-match; candies pasan a tener uso real.

**Criterios de aceptación:**
- [ ] Se puede evolucionar en partida cumpliendo el coste; el sprite cambia sin recargar.
- [ ] Tests de la acción y del consumo de recursos.

**Investigación:** `GameAction` union (`GameActionService.ts:7-13`), `this.resources`
(`GameService.ts:35`, `collectTurnResources` L550-558, nunca se decrementan), sprite por
nombre (`net/PokeSprites.ts`, `EntityView` lee `occupant.name`).

**Dependencias:** →T9.1. **Paralelizable:** no.

---

# ÉPICA 10 — Intercambio entre jugadores

## 🎟️ T10.1 — Backend de intercambio (Pokémon + objetos + monedas)

**Historia de usuario:** Como jugador, quiero intercambiar Pokémon, objetos y monedas
con mis amigos de forma segura, para completar mi colección y evolucionar por intercambio.

**Objetivos de desarrollo:**
1. Nuevo `TradeModel`/`TradeController`/rutas: proponer, aceptar, cancelar un intercambio
   entre dos amigos, con **escrow** (patrón de `AuctionService`) para retener lo ofertado
   hasta que ambos confirmen.
2. **Extender** el "regalar/vender" ya existente (venido en TR.1: `InventoryController` +
   `ContextMenu`), no reinventarlo.
3. Mover propiedad con `OwnedPokemonModel.transfer`/`ItemModel`/`UserModel.addCoins`.

**Dudas resueltas (D17):** sistema de intercambio propio, sobre amigos/escrow.

**Criterios de aceptación:**
- [ ] Dos amigos pueden intercambiar Pokémon+objetos+monedas con confirmación por ambos.
- [ ] El escrow impide perder lo ofertado si el trato se cancela.
- [ ] Tests del flujo y del escrow.

**Investigación:** `FriendModel`/`FriendController` (amistad), `AuctionService` (patrón
escrow), `OwnedPokemonModel`/`ItemModel`/`UserModel.addCoins`, "regalar" post-TR.1
(`531d6f5`), `CommunityMenuView` step `gift`.

**Dependencias:** →TR.1. **Paralelizable:** sí (parte).

## 🎟️ T10.2 — UI de intercambio (frontend)

**Historia de usuario:** Como jugador, quiero una pantalla clara para ofertar y aceptar
intercambios desde Comunidad y desde el inventario.

**Objetivos de desarrollo:** menú de intercambio en `CommunityMenuView` (junto a "ENVIAR
REGALO", ya funcional tras TR.1) y opción en el `ContextMenu` del inventario.

**Criterios de aceptación:**
- [ ] Se puede montar una oferta (Pokémon/objetos/monedas), enviarla y aceptarla desde la UI.

**Investigación:** `CommunityMenuView.ts` (step `gift`/`dm`), `ContextMenu.ts` (post-TR.1),
`net/api.ts`.

**Dependencias:** →T10.1. **Paralelizable:** no.

## 🎟️ T10.3 — Evoluciones por intercambio

**Historia de usuario:** Como jugador, quiero que Kadabra, Machoke, Graveler y Haunter
evolucionen al ser intercambiados, fiel a Gen 1.

**Objetivos de desarrollo:** al completar un intercambio, comprobar con T9.1 si la
instancia intercambiada evoluciona por intercambio y aplicarlo.

**Dudas resueltas (D17, D13):** el intercambio dispara Kadabra→Alakazam, Machoke→Machamp,
Graveler→Golem, Haunter→Gengar.

**Criterios de aceptación:**
- [ ] Intercambiar un Kadabra lo convierte en Alakazam para quien lo recibe.
- [ ] Tests de las 4 evoluciones por intercambio.

**Investigación:** T9.1 (resolución), T10.1 (completar trade).

**Dependencias:** →T10.1, →T9.1. **Paralelizable:** no.

---

## Grafo de dependencias (resumen)

- **Raíz (bloquea todo):** TR.1.
- **Arranque en paralelo tras TR.1:** T0.1, T0.2, T0.3, T1.1, T2.1, T4.1, T5.1, T5.2,
  T6.1, T8.1, T10.1.
- **Ruta crítica frontend:** T0.1 → T0.4 → (T1.2, T2.3, T3.2/3.4, T4.4, T8.5).
- **Ruta crítica progresión:** T6.1 → T6.2 → T6.3 → {T7.1, T8.2}.
- **Ruta crítica evolución:** T5.2 → T9.1 → {T9.3, T9.4, T10.3}; T9.2 → T9.3.

## Orden de desarrollo sugerido

1. **TR.1** (reconciliación).
2. **Épica 0** (fundaciones) en paralelo con los tickets `[P]` de bajo riesgo (T1.1, T2.1,
   T4.1, T5.1, T5.2, T6.1, T8.1).
3. **Épicas 1-4** (completar las mecánicas tácticas del doc 11), apoyadas en Épica 0.
4. **Épicas 5-7** (Gen 1, progresión, unificación a Pokémon propios) — habilitan el resto.
5. **Épica 8** (captura) y **Épica 9** (evolución).
6. **Épica 10** (intercambio + evoluciones por intercambio).

> Cada épica debe dejar el stack acumulado levantando (`make up`) sin romper lo anterior,
> y (donde aplica) mergear `tactics → main` al cerrarla.
