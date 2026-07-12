# Auditoría de arquitectura MVC — Transcendence Pokémon Edition

> **[HISTÓRICO]** Auditoría puntual del 2026-07-05. Los hallazgos "Corregido" ya
> están aplicados en el código actual; los "Diferido" siguen pendientes — ver
> [`docs/03-ARCHITECTURE.md`](../03-ARCHITECTURE.md) para el estado vigente y
> [`REFACTOR_PLAN.md`](REFACTOR_PLAN.md) para el plan de remediación derivado.

> Fecha: 2026-07-05 · Alcance: `services/game-service/`, `services/frontend/`,
> `packages/shared/`. Metodología: 2 agentes en paralelo (backend y frontend).

## Veredicto global

La intención MVC es clara y, en el **núcleo del dominio**, la ejecución es buena:
`engine/` + `GameService` (backend) y `GameState` (frontend) son capas puras,
observables y testeables; el servidor es autoritativo. La deuda se concentra fuera de
ese núcleo: contratos duplicados, orquestación triplicada, God objects y fugas de la
capa de transporte hacia la de dominio.

---

## Backend `game-service`

### Diagrama ACTUAL (resumen)
```
HTTP ─routes─► controllers (finos salvo Game/OnlineGame = GORDOS)
WSS  ─ws.routes── DUPLICA los controllers de juego enteros
                   │
                   ▼
        services: MatchManager (God object) · RoomService ──► hub.broadcast (✗ svc toca WSS)
                   │                              PokemonService · GameService (PURO ✔)
                   ▼
        engine/ (PURO ✔ + tests) ─► models/ (encapsula SQL ✔; migraciones ad-hoc ✗)

packages/shared: SOLO lobby + enums (en minúsculas)  ✗ DRIFT vs frontend/models/Types.ts (MAYÚSCULAS)
```

### Hallazgos
| # | Sev. | Hallazgo | Archivos | Estado |
|---|------|----------|----------|--------|
| 1 | ALTA | Drift real de tipos de dominio back↔front; `shared` no tiene los contratos y usa enums en minúsculas | `GameService.ts`, `engine/board.ts`, `frontend/models/Types.ts`, `shared/index.ts` | Corregido |
| 2 | ALTA | Pipeline de acción **triplicado** (GameController, OnlineGameController, ws.routes) con drift funcional en combate | `controllers/*`, `routes/ws.routes.ts` | Corregido |
| 3 | ALTA | Lógica de economía dentro de un controlador; local no reparte monedas | `OnlineGameController.ts:11-39` | Corregido |
| 4 | ALTA | Servicio de dominio llama al transporte WSS | `RoomService.ts` (`hub.broadcast`) | Diferido |
| 5 | ALTA | `MatchManager` es un God object (373 líneas, 7 responsabilidades) | `services/MatchManager.ts` | Diferido |
| 6 | MEDIA | Dos mecanismos de identidad conviviendo (hook vs `resolveUser`) | `app.ts`, `identity.ts` | Corregido |
| 7 | MEDIA | Migraciones no versionadas dentro de `db.ts` | `models/db.ts:27-178` | Documentado |
| 8 | MEDIA | `loot.ts` puro y sin tests | `services/loot.ts` | Corregido (tests) |
| 9 | BAJA | `any` en `board.ts` (`serialize`/`deserialize`) | `engine/board.ts:138` | Corregido |
| 10 | BAJA | Helpers repetidos (`isHex`, `requireUserId`, `COMBAT_ACTIONS`) | varios | Corregido |

---

## Frontend `frontend`

### Diagrama ACTUAL (resumen)
```
MUNDO "TABLERO" (MVC razonable): Servidor ─REST/WSS─► GameController ─► GameState (store obs.) ─► Views
   pero GameController = God object (red + WSS + cámara + input + DOM por ID)
   y fetch a PokeAPI directo desde el controlador y desde 6 vistas.

MUNDO "HUB" (MVC difuso): main.ts (router imperativo, estado en módulo + window)
   ↕ import circular (views → main.show*)
   Views con apiFetch/WebSocket propios + estado + HTML en strings → DOM = fuente de verdad de facto.
```

### Hallazgos
| # | Sev. | Hallazgo | Archivos | Estado |
|---|------|----------|----------|--------|
| 1 | ALTA | `GameController` God object (648 líneas: red, WSS, cámara, input, DOM) | `controllers/GameController.ts` | Diferido |
| 2 | ALTA | Vistas del hub con lógica de negocio y red directa | `views/hub/*` | Parcial (PokeSprites ✅; `*Api` diferido) |
| 3 | ALTA | Carga de sprites PokeAPI duplicada en 6 sitios (salta `pokeapi-proxy`) | 6 archivos | Corregido |
| 4 | MEDIA | Paleta de colores y utilidades (`escape`, `spriteOf`) duplicadas | varios | Corregido (`escape`/`spriteOf` ✅; colores: util creado, wiring parcial) |
| 5 | MEDIA-ALTA | Estado inconsistente: store en tablero, DOM en hub; getters con efectos | `models/GameState.ts`, hub | Diferido |
| 6 | MEDIA | `main.ts` router imperativo con acoplamiento circular y estado en `window` | `main.ts` + 10 vistas | Diferido |
| 7 | MEDIA | Lógica atada al DOM/red, poco testeable | varios | Diferido |
| 8 | BAJA-MEDIA | Dos patrones de vista conviviendo; `View.destroy()` inconsistente | varios | Documentado |

## Fortalezas a preservar
- `engine/` + `GameService` + `GameState`: capas puras/observables, buen modelo a generalizar.
- `net/api.ts` (`apiFetch`) y `net/WsClient.ts`: abstracción de red correcta.
- `panel.ts`: buena factorización de UI 8-bit.
- Disciplina de servidor autoritativo.
