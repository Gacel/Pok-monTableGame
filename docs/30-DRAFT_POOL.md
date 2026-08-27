# 30 · Draft con pool aleatorio (Épica 7 · T7.1, reinterpretado)

> Documento de la **Épica 7**. **Decisión del usuario (revisa D15):** el draft **NO se
> elimina**. Se mantiene para partidas **locales** y **vs-IA**, pero su pool pasa a ser
> **50 Pokémon Gen-1 aleatorios en cada draft** (antes: una lista fija de ~23). Los modos
> online de equipo propio (BR/ARENA) siguen usando el inventario por `ownedId` (Épica 6); el
> online 1v1/2v2 conserva su **roster estable**. Vigente desde 2026-08-03.

## Por qué (desviación de D15)

D15 planteaba «eliminar el draft; todos los modos usan Pokémon propios». Al implementarlo, el
**local hot-seat** (varios humanos en un mismo navegador, una sola cuenta) y el **vs-IA** no
tienen inventarios propios para cada bando. El usuario decidió: **mantener el draft** en local
e IA, pero hacerlo **variado** con un pool aleatorio de 50 por draft.

## Qué cambia

- **Pool aleatorio** (backend):
  - [`engine/gen1.ts`](../services/game-service/src/engine/gen1.ts): `randomGen1Names(n, rng?)`
    — `n` nombres Gen-1 distintos, barajado Fisher-Yates con `rng` inyectable (puro,
    testeable).
  - [`MatchManager.draftPool(50)`](../services/game-service/src/services/MatchManager.ts):
    resuelve esos 50 nombres a plantillas (PokeAPI cache-first). **No** se cachea la selección
    (aleatoria cada draft); sí las plantillas.
  - Endpoint `GET /api/game/draft-pool`
    ([`GameController.getDraftPool`](../services/game-service/src/controllers/GameController.ts),
    ruta en `game.routes.ts`). El `GET /api/game/roster` (estable) se conserva para el online
    1v1/2v2.
- **Validación** ([`resolveTeams`](../services/game-service/src/services/MatchManager.ts)): ya
  no valida contra un roster fijo; acepta **cualquier especie Gen-1** (`isGen1`) y la resuelve
  por PokeAPI, manteniendo la **regla de unicidad cruzada** (ningún Pokémon repetido entre
  equipos). Así valen los picks del pool aleatorio. El online sigue restringido a `ROSTER_NAMES`
  en `RoomService.submitTeam` (pool estable compartido).
- **Frontend**:
  - [`DraftView`](../services/frontend/src/views/hub/DraftView.ts): `poolEndpoint` configurable
    (por defecto `/api/game/roster`).
  - [`main.ts`](../services/frontend/src/main.ts): el draft **local** y el **vs-IA** usan
    `/api/game/draft-pool`; la IA (`pickAiTeam`) toma su equipo del mismo pool aleatorio
    (filtrando los del humano, para respetar la unicidad del servidor).

## Modos y su fuente de equipo (resumen)

| Modo | Fuente de equipo |
|------|------------------|
| Local hot-seat (FFA/2v2) | Draft, **pool aleatorio 50** (compartido, sin repetir) |
| Un jugador (vs-IA) | Draft, **pool aleatorio 50**; la IA toma del mismo pool |
| Online 1v1 / 2v2 (ffa/teams) | Draft, **roster estable** (`ROSTER_NAMES`) |
| Online BR / ARENA | **Inventario propio** por `ownedId` (Épica 6) |

## Verificación

- [`test/gen1.test.ts`](../services/game-service/test/gen1.test.ts) — `randomGen1Names`: 50
  distintos y Gen-1; satura en 151; con `rng` distinto, selección distinta. game-service
  **108/108**, `tsc` limpio en los 3 workspaces, build + contenedores OK.
- Smoke: `GET /api/game/draft-pool` responde tras el guard de auth (401 sin token, igual que
  `/roster`), ruta registrada.
