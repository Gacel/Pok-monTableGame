# MOVES_SYSTEM.md — Sistema de ataques (moves)

> Documento vivo. Describe el **sistema de ataques por Pokémon** del `game-service`:
> importación desde PokeAPI, persistencia en SQLite, curación de 4 ataques por
> Pokémon, fórmula de daño, coste de recursos y endpoint. Lee antes `CLAUDE.md`
> (stack y reglas) y [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md) (arquitectura MVC del servicio).

---

## 1. Qué cambia respecto al MVP anterior

Antes, el combate ofrecía **4 acciones genéricas iguales para todos los Pokémon**:
`ATACAR`, `HABILIDAD` (×1.6), `OBJETO`, `HUIR`. No existían movimientos propios de
cada especie.

Ahora, además de esas acciones (que **se mantienen**), cada Pokémon lleva **hasta 4
ataques reales** (`MOVE`) importados y curados desde PokeAPI. La ventaja de tipo la
aporta el **tipo del movimiento**, no el del Pokémon, y la potencia del movimiento
escala el daño.

En paralelo, el roster del draft se ha **purgado de evoluciones** (ver §9): pasa de
32 a 27 Pokémon (solo formas base).

---

## 2. Arquitectura y piezas (MVC del game-service)

| Capa | Fichero | Responsabilidad |
|------|---------|-----------------|
| **Dominio (tipos)** | `src/engine/board.ts` | Tipos `PokemonMove`, `MoveDamageClass`; `Pokemon.moves?`. |
| **Combate (puro)** | `src/engine/combat.ts` | `computeMoveDamage()` — daño determinista de un ataque. |
| **Modelo** | `src/models/db.ts` | Tablas `moves` y `pokemon_moves` + índice. |
| **Modelo** | `src/models/MoveModel.ts` | `findMove/saveMove/hasLearnset/listLearnset/saveLearnset`. |
| **Servicio** | `src/services/PokemonService.ts` | Fetch PokeAPI, `hydrateMove()`, `getCuratedMoves()`, learnset. |
| **Servicio** | `src/services/MatchManager.ts` | `withMoves()` — adjunta los 4 ataques al crear la partida. |
| **Servicio** | `src/services/GameService.ts` | Acción de combate `MOVE`, coste de candies, daño. |
| **Controlador/Rutas** | `src/controllers/GameController.ts`, `src/routes/game.routes.ts` | Endpoint `POST /api/game/combat/action`. |
| **Frontend** | escena de combate | Renderiza ≤4 botones de ataque + `OBJETO` + `HUIR`; envía `{action:'MOVE', moveName}`. |

> `engine/` sigue siendo **lógica pura y testeable** (sin HTTP ni SQLite): la
> fórmula de daño vive ahí. El acceso a PokeAPI y a SQLite queda en `services/` y
> `models/`.

---

## 3. Modelo de datos (SQLite del game-service)

Dos tablas nuevas en `src/models/db.ts`:

```sql
-- Catálogo de movimientos importado de PokeAPI (deduplicado por nombre).
CREATE TABLE IF NOT EXISTS moves (
  name         TEXT PRIMARY KEY,   -- ej. 'ember', 'water-gun'
  type         TEXT NOT NULL DEFAULT 'NORMAL',  -- tipo normalizado al dominio
  power        INTEGER,            -- potencia base (NULL si no hace daño)
  accuracy     INTEGER,            -- 0-100 (informativo)
  pp           INTEGER,            -- puntos de poder (informativo)
  damage_class TEXT,               -- 'physical' | 'special' | 'status'
  short_effect TEXT,               -- descripción corta (en)
  raw_data     TEXT                -- JSON crudo de PokeAPI (auditoría/futuro)
);

-- Learnset: qué movimientos puede aprender cada Pokémon.
CREATE TABLE IF NOT EXISTS pokemon_moves (
  pokemon_name TEXT NOT NULL,
  move_name    TEXT NOT NULL,
  learn_method TEXT,               -- 'level-up' | 'machine' | 'egg' | 'tutor'...
  level        INTEGER NOT NULL DEFAULT 0,  -- nivel al que se aprende (level-up)
  PRIMARY KEY (pokemon_name, move_name)     -- sin FK: no depende del orden de inserción
);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_pokemon ON pokemon_moves(pokemon_name);
```

Notas de diseño:
- `moves` está **deduplicado** por nombre: un mismo `ember` lo comparten todos los
  Pokémon que lo aprenden; solo se hidrata (fetch de detalles) una vez.
- `pokemon_moves` **no tiene FK** a `moves` ni a `pokemons` a propósito: el learnset
  se guarda antes de conocer los detalles de cada movimiento, evitando depender del
  orden de inserción.
- El learnset completo se importa **gratis** desde `/api/v2/pokemon/{name}` (viene en
  el campo `moves[]` de la misma respuesta que ya se pedía para stats/tipo).

---

## 4. Flujo de importación PokeAPI → SQLite

```
                         primera partida (cache fría)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  MatchManager.withMoves(placements)   (Promise.all sobre ≤12 Pokémon)  │
 └───────────────┬──────────────────────────────────────────────────────┘
                 │  por cada Pokémon:
                 ▼
     PokemonService.getCuratedMoves(name, type)
                 │
                 │ 1) ¿hay learnset en pokemon_moves?  (MoveModel.hasLearnset)
        ┌────────┴─────────┐
       NO                  SÍ
        │                   │
        ▼                   │
  fetch /api/v2/pokemon/{n} │      (learnset ya cacheado en la 1ª carga del roster)
  learnsetFrom(data)        │
  MoveModel.saveLearnset ───┘
                 │
                 │ 2) prioriza candidatos: level-up → machine → resto
                 │    y ACOTA a CANDIDATE_CAP (14)  ← limita los fetch
                 ▼
     por cada candidato: PokemonService.hydrateMove(moveName)
                 │
                 │  ¿está en tabla `moves`?
        ┌────────┴─────────┐
       SÍ (cache hit)      NO
        │                   │
        │                   ▼
        │        fetch /api/v2/move/{name}  (timeout 7 s)
        │        MoveModel.saveMove(row, raw)
        └─────────┬─────────┘
                  │ 3) filtra power>0, ordena por STAB y potencia,
                  │    coge 4 y GARANTIZA ≥1 físico (golpe gratuito)
                  ▼
        pokemon.moves = PokemonMove[≤4]   → viaja en el estado de la partida

              partidas siguientes (cache caliente)
 ────────────────────────────────────────────────────────────────────────
   learnset y detalles ya están en SQLite → SIN red → respuesta instantánea.
```

Robustez ante fallos de PokeAPI:
- Cada fetch tiene **timeout de 7 s** (`FETCH_TIMEOUT_MS`) vía `AbortController`.
- Si algo falla, `getCuratedMoves()` devuelve al menos un **golpe básico**
  (`fallbackMove`): `{ name:'golpe', power:45, damageClass:'physical' }`. La partida
  nunca se queda sin ataques.

Constantes relevantes (`PokemonService.ts`):
- `CANDIDATE_CAP = 14` — candidatos del learnset que se hidratan como mucho.
- `CURATED_COUNT = 4` — ataques mostrados en combate.
- `FETCH_TIMEOUT_MS = 7000`.

---

## 5. Curación de los 4 ataques (`getCuratedMoves`)

Objetivo: de un learnset de decenas de movimientos, elegir 4 útiles para combate,
sin pagar más red de la necesaria. Pasos:

1. **Prioriza por método de aprendizaje**: primero `level-up`, luego `machine` (MT),
   luego el resto. Se corta a `CANDIDATE_CAP (14)`.
2. **Hidrata** los candidatos (detalles desde `moves` o PokeAPI) y **filtra los que
   hacen daño** (`power > 0`) — se descartan los de clase `status`/sin potencia.
3. **Ordena por STAB y potencia**: primero los del **mismo tipo que el Pokémon**
   (bonus de daño), y a igualdad, mayor `power` primero.
4. Toma los **4 primeros** (sin duplicados por nombre).
5. **Garantiza ≥1 ataque físico**: si ninguno de los 4 es `physical`, descarta el
   último y **antepone** el golpe básico gratuito. Así siempre hay una opción sin
   coste de candies.

Resultado: `PokemonMove[]` de longitud ≤ 4 con `{ name, type, power, damageClass,
accuracy?, pp? }`, adjuntado a `pokemon.moves`.

---

## 6. Fórmula de daño (`computeMoveDamage`)

En `src/engine/combat.ts` (determinista, sin azar → testeable):

```
POWER_REF = 60          // un movimiento de potencia 60 ≈ golpe básico
STAB_MULT = 1.2         // bonus si el tipo del movimiento == tipo del Pokémon

power = move.power > 0 ? move.power : 40
adv   = typeAdvantage(move.type, defender.type)   // ventaja la aporta el MOVIMIENTO
stab  = (move.type === attacker.type) ? 1.2 : 1.0

damage = max(1, round( ATK_ef * (power / 60) * adv * stab ) − floor(DEF_ef / 2))
```

- `ATK_ef` / `DEF_ef`: ataque/defensa efectivos con modificadores de terreno
  (`effectiveAtk` / `effectiveDef` de `environment.ts`).
- La **ventaja de tipo la determina el tipo del movimiento**, no el del Pokémon: un
  Pokémon de AGUA con un ataque de FUEGO golpea como FUEGO frente al defensor.
- Convive con `computeDamage()` (golpe genérico de `ATACAR`/`HABILIDAD`), que usa el
  tipo del Pokémon.

Ejemplo: atacante FIRE (ATK_ef 60) usa `ember` (type FIRE, power 40) contra defensor
GRASS (DEF_ef 40), con ventaja FIRE>GRASS = 1.5 (según `typeAdvantage`):
`round(60 * (40/60) * 1.5 * 1.2) − 20 = round(72) − 20 = 52`.

---

## 7. Coste de recursos (candies)

La acción `MOVE` en `GameService.combatAction`:

- Busca el movimiento en `actor.moves` por `moveName`. Si no existe → error
  `'Ataque no disponible'`.
- **Ataques `physical`**: gratuitos.
- **Ataques `special`**: cuestan **1 candy del tipo del movimiento**
  (`spendCandies(playerId, 1, move.type)`). Sin candies → error
  `'Sin candies para ataque especial'`. El mapeo tipo→candy: `FIRE→FIRE_CANDY`,
  `WATER`/`ICE→WATER_CANDY`, resto `→GRASS_CANDY`.
- Ataques de clase `status` no se curan (se filtran en §5), así que no llegan a
  combate como `MOVE`.

Las acciones antiguas conservan su coste: `HABILIDAD` = 1 candy del tipo del Pokémon
(×1.6 daño), `OBJETO` = 2 candies (cura 30% de maxHp), `ATACAR`/`HUIR` gratis.

---

## 8. Endpoint (contrato)

`POST /api/game/combat/action`

```jsonc
// Ataque real de un Pokémon:
{ "action": "MOVE", "moveName": "ember" }

// Acciones previas (siguen soportadas):
{ "action": "ATACAR" }
{ "action": "HABILIDAD" }
{ "action": "OBJETO" }
{ "action": "HUIR" }
```

- Schema Fastify: `action` ∈ `['ATACAR','HABILIDAD','OBJETO','HUIR','MOVE']`;
  `moveName` string opcional (`maxLength: 40`).
- Respuesta: `{ success: true, state }` con el `MatchStateDTO` actualizado; en error
  `{ success: false, error, state }` con código `400`.
- Tras aplicar, el estado se **persiste** en SQLite y se **difunde por WSS**
  (`hub.broadcast({ type:'state', state })`).

El frontend renderiza un botón por cada `pokemon.moves[i]` (además de `OBJETO` y
`HUIR`) y envía `{ action:'MOVE', moveName }`.

---

## 9. Purga de evoluciones del roster (draft)

`MatchManager.ROSTER_NAMES` pasó de **32 a 27** Pokémon: se eliminaron 5 evoluciones
(`charizard`, `blastoise`, `pidgeot`, `dragonite`, `jolteon`). El pool del draft
queda con **solo formas base**; las evoluciones se tratarán más adelante (evolución
en partida, ver [`01-IMPLEMENTATION_PLAN.md`](01-IMPLEMENTATION_PLAN.md) C3.8 — no implementada todavía).

Consecuencias en la distribución por tipo:
- `FLYING` queda solo con `aerodactyl` (se fue `pidgeot`).
- `DRAGON` queda solo con `dratini` (se fue `dragonite`).
- `ELECTRIC` queda solo con `pikachu` (se fue `jolteon`).

Los equipos por defecto (`buildDefault`) siguen formándose con 3 Pokémon por tipo
(FIRE / WATER / GRASS / ELECTRIC+NORMAL), sin verse afectados por la purga.

---

## 10. Pendiente / futuro

> **Rango, forma (AoE) y selección — Épica A (doc 12).** La derivación actual de
> `range`/`aoe` en `PokemonService.toMove` es **provisional** (heurística rudimentaria:
> rangos irreales, formas sin sentido, `radius` castable en cualquier casilla). La selección
> de los 4 moves también se rehará. Se corrige en la **Épica A — Sistema de ataques**
> ([`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md)): TA.1 (catálogo híbrido de rango/forma +
> `radius` propio + validación de rango), TA.2 (selección por heurística mejorada), TA.3
> (previsualización en el mapa), TA.4 (tutor de movimientos, diferido).


- **`pokeapi-proxy` + Redis (C3.1)**: hoy el `game-service` llama a `pokeapi.co`
  directamente y cachea en su propio SQLite. Según `CLAUDE.md`, el fetch/transform y
  la **caché agresiva en Redis** deben vivir en el microservicio `pokeapi-proxy`. La
  hidratación de moves debería migrarse a ese proxy (una única fuente de datos de
  PokeAPI para todo el sistema).
- **Hidratar el learnset completo**: hoy solo se hidratan los detalles de ≤14
  candidatos por Pokémon (`CANDIDATE_CAP`). Un job de fondo podría hidratar el
  learnset entero y ampliar/rotar el pool de ataques.
- **Evoluciones (C3.8)**: al implementar la evolución en partida, el Pokémon
  evolucionado deberá recalcular sus ataques curados (nuevo tipo/learnset) y
  reintegrar las 5 formas purgadas como resultado de evolución, no como opción de
  draft.
- **Efectos de estado**: los movimientos `status` se descartan; en el futuro podrían
  aplicar efectos (quemadura, parálisis…) en lugar de daño directo.
- **STAB/ventaja finas**: la tabla de tipos del dominio está simplificada
  (`typeAdvantage`); ampliarla al matcheo completo de PokeAPI es trabajo futuro.
