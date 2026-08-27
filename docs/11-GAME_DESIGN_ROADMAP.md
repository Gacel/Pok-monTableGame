# Pokémon Tactics — Documento de Diseño y Hoja de Ruta Completa

> Documento maestro que describe **todas las fases del juego**, desde los cimientos
> del motor hasta las mecánicas tácticas avanzadas. Cada fase detalla qué se
> construyó (o se construirá), qué archivos están involucrados y cómo encajan las
> piezas entre sí. Sirve como referencia para cualquier desarrollador que se
> incorpore al proyecto.
>
> **Leyenda:** ✅ Implementado · 🟧 Parcial · ⬜ Pendiente

---

## Índice

1. [Fase 0 — Cimientos: Tablero Hexagonal y Geometría](#fase-0)
2. [Fase 1 — Motor de Combate Táctico en Mapa](#fase-1)
3. [Fase 2 — Stats Reales, Movimientos de PokeAPI y Fórmula de Daño](#fase-2)
4. [Fase 3 — Sigilo y Hierba Alta (La Emboscada)](#fase-3)
5. [Fase 4 — Pasivas y Efectos de Terreno Avanzados](#fase-4)
6. [Fase 5 — Movimientos Tácticos (Desplazamientos y Control de Masas)](#fase-5)
7. [Fase 6 — Bodyblocking, Tamaños Reales y Línea de Visión](#fase-6)

---

<a id="fase-0"></a>
## Fase 0 — Cimientos: Tablero Hexagonal y Geometría ✅

### Objetivo
Construir el tablero de juego sobre el que se sostiene todo lo demás: una cuadrícula hexagonal con coordenadas axiales, generación procedural de ecosistemas, zonas de despliegue y un sistema de spawns que garantice equidad.

### Implementación

#### 0.1 Sistema de coordenadas hexagonales
El juego usa el sistema **axial (q, r)** con hexágonos *pointy-top*. Toda la aritmética hexagonal (suma, resta, distancia, vecinos) está centralizada en un único módulo compartido.

- **Tipo canónico:** [`Hex { q, r }`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L11-L14) — definido en `@transcendence/shared` y re-exportado por el backend.
- **Aritmética:** [`hexAdd`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/hex.ts#L10-L12), [`hexDistance`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/hex.ts#L18-L26), [`hexNeighbors`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/hex.ts#L37-L39) — calculan las 6 celdas adyacentes, la distancia Manhattan hex, etc.
- **Constantes de dirección:** [`DIRECTIONS`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/movement.ts#L5-L8) (6 vecinos), [`DIAGONALS`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/movement.ts#L11-L14) y [`KNIGHT_JUMPS`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/movement.ts#L17-L22) — definidos pero los dos últimos aún no se usan en la lógica de movimiento base.

#### 0.2 Generación procedural del mapa (mini-Whittaker)
El tablero no se diseña a mano: se genera proceduralmente a partir de una *seed* usando un modelo climático simplificado que combina tres campos de ruido continuo (elevación, temperatura, humedad).

- **Generador:** [`generateEcosystem(seed, opts)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/mapGenerator.ts#L42-L90) — produce un `Board` de radio configurable (por defecto R=20 → ~1261 tiles).
- **Clasificación de biomas:** La función [`classify(elevation, temperature, humidity)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/mapGenerator.ts#L93-L109) aplica reglas tipo Whittaker:
  - Elevación baja → `WATER`
  - Franja costera → `SAND`
  - Cumbres frías → `ICE`, calientes → `FIRE`
  - Zonas húmedas → `GRASS`
- **Suavizado:** Un [`smoothLand`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/mapGenerator.ts#L116-L140) (majority filter) elimina el ruido sal-y-pimienta sin tocar el agua.
- **Ruido casero:** [`noise.ts`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/noise.ts) implementa value noise 2D + fractal octaves sin dependencias externas (requisito del proyecto).

**Biomas disponibles** (tipo [`Biome`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L17-L18)):
| Bioma | Representación | Rol táctico |
|---|---|---|
| `GRASS` | Pradera verde | Terreno neutro, coste 1 |
| `TALL_GRASS` | Hierba alta | Sigilo (Fase 3) |
| `WATER` | Océano/lago | Barrera natural (tipo Fuego no entra) |
| `FIRE` | Lava/volcán | Daño progresivo por turno |
| `SAND` | Playa/desierto | Terreno neutro |
| `ICE` | Glaciar | Coste 2 salvo tipo Hielo |
| `MOUNTAIN` | Montaña | Coste 2, Pokémon grandes no entran |
| `SWAMP` | Pantano | Daño tóxico (salvo Veneno/Acero) |

#### 0.3 Spawns y Zonas de Despliegue
Los jugadores no eligen dónde empezar libremente: el servidor calcula zonas de despliegue equitativas.

- **Componente conexa:** [`largestLandComponent(board)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/spawns.ts#L17-L40) — flood-fill que garantiza que todos los spawns estén en tierra mutuamente alcanzable.
- **Spawns por esquinas (1v1, 2v2, FFA):** [`pickCornerSpawns`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/spawns.ts#L167-L210) — asigna cada equipo a una esquina del mapa (NW, SE, NE, SW).
- **Spawns aleatorios (Arena):** [`pickRandomSpawns`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/spawns.ts#L127-L162) — muestreo de N centros aleatorios maximizando la distancia mínima entre equipos.
- **Zonas Voronoi:** Al crear la partida, [`GameService.create`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L46-L112) calcula un diagrama de Voronoi sobre tierra asignando cada tile al jugador cuyo spawn está más cerca. Esto genera las `deploymentZones` que el frontend pinta como áreas coloreadas.

#### 0.4 Fase de Despliegue (pre-partida)
Antes de que empiece la acción, los jugadores tienen **42 segundos** para colocar manualmente sus Pokémon dentro de su zona.

- **Estado `'deployment'`:** La partida arranca siempre en este estado. El [`deploy(playerId, pokemonId, hex)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L236-L277) valida que la casilla pertenezca a la zona del jugador y que esté libre.
- **Auto-colocación:** Si el timer expira o todos han desplegado, [`forceStart()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L279-L304) coloca aleatoriamente los Pokémon restantes y cambia a `'active'`.

#### 0.5 La clase Board
[`Board`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/board.ts#L17-L130) es el contenedor de tiles. Sus métodos clave:
- `getOccupiedHexes(pokemon, center)` — devuelve 1 hex (small/medium) o 7 hexes (large = centro + 6 vecinos).
- `moveOccupant(from, to)` — limpia las casillas antiguas, actualiza la orientación (`facing`) según la dirección y ocupa las nuevas.
- `serialize()` / `deserialize()` — para persistir partidas en SQLite.

#### 0.6 Renderizado en el Frontend
- **Canvas del tablero:** [`BoardView`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/frontend/src/views/BoardView.ts) — renderiza hexágonos con texturas de bioma, highlights de movimiento/ataque, y proyección isométrica (`isoScale = 0.55`).
- **Sprites de Pokémon (capa DOM):** [`EntityView`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/frontend/src/views/EntityView.ts) — cada Pokémon es un `<img>` con GIF animado de PokeAPI, posicionado sobre la capa `#entities-layer` con z-index dinámico basado en la Y de pantalla.
- **Minimapa:** [`MinimapView`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/frontend/src/views/MinimapView.ts) — versión reducida del tablero completo con click-to-navigate.

---

<a id="fase-1"></a>
## Fase 1 — Motor de Combate Táctico en Mapa ✅

### Objetivo
Implementar un sistema de combate que ocurra **directamente sobre el tablero hexagonal**, sin pantallas secundarias de combate. Cada Pokémon puede moverse y atacar en el mismo turno, con daño resuelto inmediatamente sobre el mapa.

### Implementación

#### 1.1 Sistema de turnos
La partida sigue un modelo **IGOUGO** (yo muevo todo, tú mueves todo):
- El jugador activo puede mover y/o atacar con **todos** sus Pokémon que no hayan actuado aún (`hasActed`).
- [`endTurn()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L473-L495) resetea `hasActed` a `false` en todas las piezas, recoge recursos, aplica daño de terreno y pasa al siguiente jugador vivo.
- La rotación de jugadores salta a los eliminados: [`switchPlayer()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L590-L601).

#### 1.2 Movimiento táctico (Dijkstra con coste de terreno)
Cada Pokémon tiene una stat `speed` (típicamente 2-5, derivada de la velocidad base de PokeAPI dividida entre 20). El movimiento se calcula con un **Dijkstra** que respeta el coste del terreno:

- **Función central:** [`getMoveOptions(hex, board, sameTeam)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/movement.ts#L35-L104) — devuelve `{ moves: Hex[], attacks: Hex[] }`.
- **Coste de terreno:** [`getTerrainCost(pokemon, biome)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L28-L49) — varía entre 1 (terreno favorable) y 2 (terreno hostil). `Infinity` = intransitable.
- **Reglas actuales:**
  - Pokémon tipo Fuego **no puede entrar** en Agua.
  - Pokémon Large **no puede escalar** Montaña.
  - Tipo Volador/Fantasma: coste siempre 1 en todo terreno.
  - Tipo afín al bioma (ej. Agua en Agua): coste 1 en vez de 2.
- **Enemigos adyacentes** a una casilla alcanzable se marcan como `attacks` (objetivos de ataque cuerpo a cuerpo).

#### 1.3 Ataques con Área de Efecto (AoE)
El combate no es solo 1vs1 adyacente. Los ataques tienen **formas de área** que cubren múltiples hexágonos:

- **Geometría AoE** (en [`@transcendence/shared/combat.ts`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/combat.ts)):
  | Tipo | Función | Descripción |
  |---|---|---|
  | `single` | `getSingleArea(target)` | 1 hex exacto |
  | `radius` | `getRadiusArea(center, r)` | Disco de radio `r` |
  | `line` | `getLineArea(start, target, len)` | Rayo recto de `len` hexes |
  | `cone` | `getConeArea(start, target, len)` | Cono que se ensancha |

- **Dispatcher:** [`calculateAoE(attackerHex, targetHex, aoe, range)`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/combat.ts#L94-L102) — el frontend lo usa para preview y el backend para resolver daño.

- **Resolución de daño:** [`GameService.cast(playerId, from, targetHex, moveIndex)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L388-L470):
  1. Valida turno, propiedad de la pieza, rango del movimiento.
  2. Calcula los hexes afectados con `calculateAoE`.
  3. Itera sobre cada hex: si hay un ocupante enemigo, calcula daño con `computeMoveDamage`.
  4. Aplica el daño, marca KOs, acumula `defeats` para la economía.
  5. Marca `hasActed = true` al atacante.

#### 1.4 Pipeline de acciones unificado
Toda acción de juego (mover, atacar, desplegar, pasar turno, abandonar) pasa por un **único pipeline** que orquesta validar → mutar → persistir → economía → difundir:

- [`GameActionService.apply(ctx, action)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameActionService.ts#L54-L75) — acepta un `ActionContext` (local vs online, matchId, room) y un `GameAction` tipado.
- Tras mutar el estado, persiste en SQLite, acredita monedas (KOs/victoria) y hace `broadcastPersonalized` por WebSocket.

#### 1.5 Condición de victoria
[`checkWinCondition()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L561-L588):
- Un jugador queda **eliminado** cuando pierde todos sus Pokémon.
- La partida termina cuando solo queda un jugador (FFA) o un equipo (2v2).
- En modo **Arena** (persistente), la partida **nunca termina** aunque queden 0 jugadores.

#### 1.6 Daño ambiental progresivo
Al final de cada turno, [`applyLavaDamage()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L518-L540) aplica daño a los Pokémon en lava. El daño se **duplica** por cada turno consecutivo en lava (`lavaTurns`), lo que convierte los volcanes en trampas mortales si no te mueves a tiempo.

- [`terrainDamage(pokemon, biome)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L67-L85) calcula el daño según tipo del Pokémon y bioma:
  - Tipo Fuego en lava: 0 (inmune).
  - Tipo Agua en lava: daño mínimo.
  - Tipo Planta/Hielo en lava: daño brutal (4 base × multiplicador).
  - Pantano: 2 de daño constante (salvo Veneno/Acero).

#### 1.7 Recursos (Caramelos de bioma)
Cada turno, [`collectResources(board)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/resources.ts#L8-L30) otorga caramelos según los biomas que controlan los Pokémon del jugador (1 caramelo por pieza por bioma ocupado). Se usan para alimentar ataques especiales (coste de candy).

#### 1.8 Sincronización en tiempo real
- **WebSocket Hub:** [`RealtimeHub`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/realtime/hub.ts#L20-L115) — agrupa sockets por sala (partida). Soporta `broadcast` (mismo mensaje a todos) y `broadcastPersonalized` (mensaje customizado por socket, usado para niebla de guerra).
- **Frontend WsClient:** Se conecta a `/ws?matchId=X&token=Y`, recibe estados y los inyecta en `GameState`.

---

<a id="fase-2"></a>
## Fase 2 — Stats Reales, Movimientos de PokeAPI y Fórmula de Daño ✅

### Objetivo
Abandonar los valores genéricos de combate y usar las **estadísticas reales** de cada especie Pokémon, importando automáticamente sus movimientos desde PokeAPI y aplicando una fórmula de daño balanceada que tenga en cuenta tipo, STAB, terreno y potencia del ataque.

### Implementación

#### 2.1 Importación de stats desde PokeAPI
[`PokemonService.getTemplate(name)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/PokemonService.ts#L97-L140):
1. Busca primero en la caché SQLite (`PokemonModel`).
2. Si no existe, llama a `https://pokeapi.co/api/v2/pokemon/{name}`.
3. Extrae: HP (×2 para gameplay), ATK, DEF, Speed (÷20 → PM).
4. Normaliza el tipo al dominio del juego (ej. `ROCK` → `NORMAL`, `BUG` → `GRASS`).
5. Persiste en SQLite para que la próxima llamada sea instantánea.

**Tipos soportados** (tipo [`PokemonType`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L21-L26)):
`FIRE`, `WATER`, `GRASS`, `POISON`, `FLYING`, `DRAGON`, `PSYCHIC`, `NORMAL`, `ELECTRIC`, `ICE`, `FAIRY`, `BUG`, `ROCK`, `FIGHTING`, `GHOST`, `GROUND`, `STEEL`.

#### 2.2 Sistema de movimientos (4 ataques por Pokémon)
Cada Pokémon entra en combate con **hasta 4 ataques reales** curados desde PokeAPI:

- **Learnset:** Al importar un Pokémon, [`PokemonService`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/PokemonService.ts#L172-L249) guarda su learnset completo en la tabla `pokemon_moves`.
- **Curación:** [`getCuratedMoves(name, pokeType)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/PokemonService.ts#L172-L249) selecciona los 4 mejores ataques:
  1. Prioriza level-up > machine > otros.
  2. Favorece STAB (mismo tipo que el Pokémon).
  3. Ordena por potencia.
  4. Garantiza al menos 1 ataque físico (gratuito).
- **Mapeo a AoE:** Según el `target` de PokeAPI:
  - `all-other-pokemon` / `all-pokemon` → `radius` (R=0, sobre uno mismo).
  - `all-opponents` → `cone` (rango 2).
  - Ataques especiales → rango 3; si potencia ≥ 90 → `line`.
  - El resto → `single`, rango 1.

**Tipo de movimiento** ([`PokemonMove`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L38-L58)):
```typescript
interface PokemonMove {
  name: string;
  displayName?: string;     // Nombre traducido (español)
  type: PokemonType;        // Tipo del ataque (dicta ventaja)
  power: number;            // Potencia base
  damageClass: 'physical' | 'special' | 'status';
  range?: number;           // Alcance en hexágonos
  aoe?: 'single' | 'line' | 'cone' | 'radius';
}
```

#### 2.3 Fórmula de daño
[`computeMoveDamage(attacker, defender, move, atkTerrain, defTerrain)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/combat.ts#L14-L30):

```
daño = ATK_eff × (power / 60) × ventaja_tipo × STAB × emboscada − DEF_eff / 2
```

Donde:
- **ATK_eff** = [`effectiveAtk`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L7-L14): ATK base × 1.2 si el bioma del atacante coincide con su tipo.
- **DEF_eff** = [`effectiveDef`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L17-L22): DEF base × 0.85 si el defensor es tipo Planta y está en lava.
- **Ventaja de tipo** = [`typeAdvantage(moveType, defenderType)`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L111-L127): 1.5 (super efectivo), 0.5 (poco efectivo), 1.0 (neutro). La ventaja la da el **tipo del movimiento**, no el del Pokémon.
- **STAB** = 1.2 si el tipo del movimiento coincide con el tipo del atacante.
- **Emboscada** = 1.5 si el atacante está oculto (`isHidden`).
- Mínimo 1 de daño garantizado.

#### 2.4 Roster de Draft
[`ROSTER_NAMES`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/MatchManager.ts#L32-L44): 24 Pokémon de forma base (sin evoluciones), cubriendo 12 tipos. En modos con draft (1v1, 2v2, local), cada Pokémon solo puede ser elegido por **un** jugador (validación de unicidad cruzada en [`resolveTeams`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/MatchManager.ts#L151-L184)).

---

<a id="fase-3"></a>
## Fase 3 — Sigilo y Hierba Alta (La Emboscada) 🟧

### Objetivo
Transformar la hierba alta (`TALL_GRASS`) de un simple bioma cosmético a una **mecánica táctica central**: los Pokémon pueden emboscarse, volverse invisibles para el rival y lanzar ataques devastadores desde las sombras.

### Estado actual (lo que ya existe)

#### 3.1 Invisibilidad en hierba alta ✅
[`updateStealthVisibility()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L343-L385) se ejecuta tras cada movimiento y al forzar el inicio de la partida. Su lógica:
1. Recorre todos los Pokémon del tablero.
2. Si **todas** las casillas que ocupa un Pokémon son `TALL_GRASS`, no tiene enemigos adyacentes y no ha actuado → lo marca como `isHidden = true`.
3. Si un enemigo se mueve a una casilla adyacente → se revela (`isHidden = false`) con log `"👁️ ¡X ha sido descubierto!"`.
4. Si sale de la hierba → se revela automáticamente.

#### 3.2 Multiplicador de emboscada ✅
En [`computeMoveDamage`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/combat.ts#L27), si `attacker.isHidden === true`, se aplica un multiplicador de **×1.5** al daño. Después del ataque, [`cast()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L464-L465) marca `caster.isHidden = false`.

#### 3.3 Niebla de guerra personalizada ✅
[`getStateDTO(requestingPlayerId)`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L192-L226): al serializar el estado para un jugador, los Pokémon enemigos con `isHidden = true` se **censuran** (se envían como `occupant: null`). Cada socket recibe un estado personalizado vía [`broadcastPersonalized`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/realtime/hub.ts#L92-L109).

#### 3.4 Representación visual del sigilo ✅
En [`EntityView`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/frontend/src/views/EntityView.ts#L127-L130), los Pokémon propios ocultos se renderizan con opacidad 0.4 (los enemigos ocultos directamente no aparecen porque el servidor no los envía).

### Lo que falta ⬜

#### 3.5 Revelación por daño AoE
Actualmente, si un ataque AoE impacta en un hex con un Pokémon oculto, el daño se aplica pero **no se revela explícitamente** al oculto (la función `updateStealthVisibility` se ejecuta después, pero solo revela por adyacencia o por salir de la hierba).

**Qué hay que hacer:** En el bucle de daño de [`cast()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L435-L458), tras aplicar daño a un `tile.occupant` que tenga `isHidden === true`, marcarlo como revelado (`isHidden = false`) y registrar un log.

#### 3.6 Feedback visual de revelación
**Qué hay que hacer:** En el frontend, cuando un Pokémon enemigo aparece por primera vez (pasa de no existir en el DTO a existir), reproducir una animación de aparición (exclamación "!" estilo Metal Gear, o un flash).

---

<a id="fase-4"></a>
## Fase 4 — Pasivas y Efectos de Terreno Avanzados 🟧

### Objetivo
Que los biomas del tablero no solo dicten el coste de movimiento, sino que apliquen **efectos pasivos** a final de turno (curación, daño, estados alterados) según el tipo del Pokémon, y que ciertos tipos tengan reglas de movimiento especiales.

### Estado actual (lo que ya existe)

#### 4.1 Coste de movimiento por tipo ✅
[`getTerrainCost`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L28-L49): ya diferencia por tipo. Tipo Volador y Fantasma tienen coste 1 en todo terreno. Tipos afines a su bioma (Agua en agua, Bicho/Planta en hierba, etc.) también coste 1.

#### 4.2 Restricciones de entrada ✅
[`canEnter`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L54-L64): Fuego no pisa agua, Pokémon grandes no escalan montaña (salvo Voladores/Fantasmas que lo ignoran todo).

#### 4.3 Daño de lava y pantano ✅
[`terrainDamage`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L67-L85): daño exponencial en lava (se duplica por turno), daño tóxico constante (2) en pantano.

#### 4.4 Bonificaciones de ATK/DEF por terreno ✅
[`effectiveAtk`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L7-L14) y [`effectiveDef`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L17-L22): +20% ATK al pelear desde tu bioma afín, -15% DEF al tipo Planta en lava.

### Lo que falta ⬜

#### 4.5 Fantasmas atravesando unidades
Actualmente, en [`getMoveOptions`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/movement.ts#L71-L83), un Pokémon no puede pasar por **ninguna** casilla ocupada (línea 83: `continue`). Los fantasmas deberían poder **atravesar** unidades (aliadas y enemigas) al calcular su camino, pero no terminar su turno en una casilla ocupada.

**Qué hay que hacer:** Modificar la condición del Dijkstra para que, si `pokemon.type === 'GHOST'`, no corte la exploración al encontrar un ocupante, sino que siga expandiéndose. Al construir la lista `moves[]`, excluir hexes ocupados como destinos finales válidos.

#### 4.6 Curación en hierba alta para tipo Planta
La función `terrainDamage` actualmente devuelve `0` para hierba alta. Los tipo Planta deberían **curarse** (5-10% de maxHp) al terminar su turno sobre `TALL_GRASS`.

**Qué hay que hacer:** Añadir una condición en `terrainDamage`: si `terrain === 'TALL_GRASS' && pokemon.type === 'GRASS'`, devolver un valor negativo representando curación. Actualizar `applyLavaDamage` (que debería renombrarse a `applyEndOfTurnEffects`) para aplicar tanto daño como curación y generar logs apropiados ("♻️ X se regenera en la hierba").

#### 4.7 Frontend: indicadores de daño/curación de terreno
No existe actualmente un sistema de "floating damage numbers" para daño de terreno. Los números de daño de combate se registran en el log lateral, pero no tienen representación visual sobre el tablero.

**Qué hay que hacer:** Crear un componente ligero (div temporal con animación CSS) que aparezca sobre el sprite del Pokémon mostrando `-5 HP` (rojo) o `+10 HP` (verde) al final del turno.

---

<a id="fase-5"></a>
## Fase 5 — Movimientos Tácticos (Desplazamientos y Control de Masas) ⬜

### Objetivo
Añadir ataques que no solo hagan daño, sino que **alteren las posiciones** de los Pokémon en el tablero: empujar, cargar, esquivar, volar. Esto transformará la profundidad estratégica del juego radicalmente.

### 5.1 Empuje (Knockback)
Ataques como Rugido o Remolino que, al impactar, calculan la trayectoria (vector atacante → víctima) y empujan al defensor **2-3 hexágonos hacia atrás**.

**Qué hay que hacer:**
1. Extender el tipo [`PokemonMove`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L38-L58) con un campo opcional `knockback?: number` (nº de hexes de empuje).
2. Crear una lista de mapeo manual: ciertos nombres de ataques de PokeAPI (ej. `roar`, `whirlwind`, `dragon-tail`) reciben `knockback: 2`.
3. En [`cast()`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/GameService.ts#L388-L470), tras aplicar daño, si el movimiento tiene `knockback`, calcular la dirección hexagonal del empuje y mover al defensor. Si choca con un obstáculo (montaña, otro Pokémon, borde del mapa), el empuje se detiene y el defensor recibe daño de colisión (ej. 10% maxHp).

### 5.2 Ataques de Desplazamiento (Dash)
Movimientos como Velocidad Extrema que permiten al atacante **desplazarse en línea recta** hacia el enemigo como parte del ataque, dañando a lo que atraviese.

**Qué hay que hacer:**
1. Añadir un campo opcional `dash?: boolean` a `PokemonMove`.
2. En el motor, un ataque dash calcula la línea entre atacante y objetivo, mueve al atacante a la casilla adyacente al objetivo, y aplica daño.

### 5.3 Ataques de 2 Turnos (Invulnerabilidad)
Movimientos como Vuelo o Excavar. En el turno 1, el Pokémon **desaparece** del tablero (no puede ser objetivo de ataques). En su siguiente turno, el jugador elige la casilla de impacto, aterriza y aplica daño.

**Qué hay que hacer:**
1. Añadir un campo `chargingMove?: { moveName: string; turnsLeft: number }` al tipo `Pokemon`.
2. Si un Pokémon está "cargando", no puede ser seleccionado como objetivo de ataques.
3. Al inicio del turno del jugador, si un Pokémon está "cargando" con `turnsLeft === 0`, el jugador debe elegir la casilla de impacto como su única acción.
4. En el frontend, renderizar un Pokémon "cargando" con una animación especial (sombra en el suelo para Vuelo, temblor del terreno para Excavar).

---

<a id="fase-6"></a>
## Fase 6 — Bodyblocking, Tamaños Reales y Línea de Visión ⬜

### Objetivo
Que el tamaño de los Pokémon tenga un impacto táctico real: los Pokémon grandes bloquean el paso, protegen a los aliados detrás de ellos interceptando proyectiles y controlan zonas del mapa.

### Estado actual (lo que ya existe)

#### 6.1 Sistema de tamaños ✅
El tipo [`PokemonSize`](file:///home/sbenitez/repositorios/42/ft_transcendence/packages/shared/src/domain.ts#L29-L30) define tres categorías: `'small'`, `'medium'`, `'large'`.
- Un Pokémon `large` ocupa **7 hexágonos** (centro + 6 vecinos) gracias a [`getOccupiedHexes`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/board.ts#L36-L41).
- [`canEnter`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/engine/environment.ts#L57-L59) ya prohíbe a los `large` escalar montañas.
- **Nota:** Actualmente todos los Pokémon del roster se crean como `'medium'` en [`PokemonService.getTemplate`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/PokemonService.ts#L119). La asignación real de tamaño por especie aún no se ha implementado.

### Lo que falta ⬜

#### 6.2 Asignación de tamaño por especie
**Qué hay que hacer:** Crear un mapeo (tabla o constante) que asigne tamaño basado en la especie:
- `small`: Pikachu, Eevee, Clefairy, Abra, Dratini, etc.
- `medium`: La mayoría del roster.
- `large`: Snorlax, Lapras, Gyarados, Onix (si se añaden).

Actualizar [`PokemonService.getTemplate`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/game-service/src/services/PokemonService.ts#L119) para que asigne el tamaño real en vez de `'medium'` por defecto.

#### 6.3 Algoritmo de Línea de Visión (LoS)
**Qué hay que hacer:** Implementar un trazado de línea hexagonal (Bresenham adaptado a coordenadas axiales) en `engine/hex.ts`:
- `hexLineDraw(a: Hex, b: Hex): Hex[]` — devuelve todos los hexes en la línea recta entre A y B.

#### 6.4 Intercepción de proyectiles por Pokémon Large
**Qué hay que hacer:** En el cálculo de ataques de tipo `line`, antes de resolver el daño, trazar la trayectoria con `hexLineDraw`. Si un hex intermedio está ocupado por un Pokémon `large`, el proyectil **impacta en él** (absorbe todo el daño) y no llega al objetivo original.

Esto convierte a los Pokémon grandes en **escudos tácticos**: puedes posicionar a tu Snorlax delante de tu Pikachu para protegerlo de un Hiperrayo enemigo.

#### 6.5 Impacto visual en el frontend
- Los Pokémon `large` deberían renderizarse con un sprite **más grande** (ej. 2× el tamaño normal) en [`EntityView`](file:///home/sbenitez/repositorios/42/ft_transcendence/services/frontend/src/views/EntityView.ts).
- Las 7 casillas que ocupan deberían tener un highlight especial en el tablero.

---

## Orden de desarrollo recomendado

```
Fase 3.5-3.6 (completar sigilo)
    ↓
Fase 4.5-4.7 (fantasmas + curación/veneno + UI)
    ↓
Fase 5.1 (knockback)
    ↓
Fase 5.2 (dash)
    ↓
Fase 6.2-6.5 (tamaños reales + LoS)
    ↓
Fase 5.3 (ataques de 2 turnos — el más complejo)
```

> [!TIP]
> Las fases 3 y 4 son las de mayor impacto/esfuerzo más bajo: ya tienen mucha base implementada. La Fase 5.3 (ataques de 2 turnos) es la más compleja por el estado intermedio que introduce, por eso se recomienda para el final.
