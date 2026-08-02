# 29 · Progresión: niveles, XP y equipos por instancia (Épica 6)

> Documento de la **Épica 6** del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md):
> los Pokémon propios pasan a tener **identidad de instancia** (`ownedId`), **nivel real**,
> **stats escaladas por nivel** y **XP** que sube de nivel combatiendo. Se extiende ticket a
> ticket. Vigente desde 2026-08-02.

## T6.3 — Equipos por instancia (`ownedId`)

**Por qué:** hasta ahora los modos de equipo propio (Battle Royale / ARENA) enviaban
**nombres** y el servidor cargaba plantillas **a nivel 1** por especie. Si tenías dos Pidgey
de niveles distintos daba igual: la partida usaba una plantilla genérica. La identidad de la
instancia (nivel, y en el futuro forma/captura) se perdía.

**Qué cambia (la pieza de partida ya lleva su instancia):**
- **Contrato:** `SubmitTeamRequest.team` sigue siendo `string[]`, pero en `OWNED_TEAM_MODES`
  (BR/ARENA) sus elementos son **`ownedId`** de `owned_pokemon`, no nombres
  ([`lobby.ts`](../packages/shared/src/lobby.ts)).
- **Engine `Pokemon.ownedId?`** ([`domain.ts`](../packages/shared/src/domain.ts)): la pieza
  arrastra la identidad de la instancia del inventario (necesario para XP —T6.1— y captura
  —Épica 8—). Las piezas de draft/roster no lo llevan.
- **Modelo** ([`OwnedPokemonModel`](../services/game-service/src/models/OwnedPokemonModel.ts)):
  - `findManyByIds(ids)` — carga varias instancias **conservando el orden** pedido.
  - `allOwnedBy(userId, ids)` — validación de propiedad autoritativa: todas existen, son del
    usuario y **no están en subasta** (escrow).
- **Validación** ([`RoomService`](../services/game-service/src/services/RoomService.ts)):
  `submitTeam` (online) y `joinArena` validan por `ownedId` con `allOwnedBy` (antes: por
  nombre en el inventario).
- **Carga real** ([`MatchManager`](../services/game-service/src/services/MatchManager.ts)):
  `resolveOwnedTeams`/`addToArena` usan `ownedTeamFromIds(ids)`: cargan la instancia
  (`findManyByIds`), toman la plantilla base por especie (PokeAPI cache-first) y le adjuntan
  `ownedId` + `level` reales. `placements`/`buildPokemon` propagan `level` (ya no fijo a 1) y
  `ownedId` a la pieza. Tipo interno `TeamPiece = PokemonTemplate & { ownedId?; level? }`.
- **Frontend** ([`OwnedTeamPickerView`](../services/frontend/src/views/hub/OwnedTeamPickerView.ts)):
  el selector ya elegía por id de instancia; ahora **envía los `ownedId`** (antes mapeaba a
  nombre). BR y ARENA reenvían esos ids como `team`.

**Nota:** el escalado de stats por ese nivel es **T6.2**; otorgar XP y subir de nivel a la
instancia (`ownedId`) al terminar la partida es **T6.1**. El camino de **draft** (1v1/2v2 por
nombre/roster) queda intacto hasta que la Épica 7 lo elimine.

**Verificación:** [`test/ownedTeam.test.ts`](../services/game-service/test/ownedTeam.test.ts)
— orden preservado y nivel real en `findManyByIds`; `allOwnedBy` (propiedad, inexistentes,
escrow). game-service **90/90**, `tsc` limpio en los 3 workspaces, build + contenedores OK.

## T6.2 — Escalado de stats por nivel

**Por qué:** con T6.3 la pieza ya trae su nivel real, pero sus stats seguían siendo las de la
plantilla (equivalente a Lv.1). Un Pokémon de nivel alto debe ser **notablemente más fuerte**.

**Cómo (curva pura y ajustable):**
- [`engine/progression.ts`](../services/game-service/src/engine/progression.ts) (puro,
  testeable):
  - `levelMultiplier(level) = 1 + (nivel-1)·0.04` — **+4 %/nivel** sobre la base, saturado a
    `[1, LEVEL_CAP=100]`. A **nivel 1 vale 1.0** → no altera nada (draft/roster intactos).
  - `scaleStat(base, level)` y `scaledVitals({maxHp,atk,def}, level)` → `hp`/`maxHp` (a tope)
    + `atk`/`def` escaladas.
- Aplicado en la **creación de la pieza** (fuente única): `MatchManager.build` (partidas) y
  `buildPokemon` (ARENA) mezclan `scaledVitals(tpl, level)`. Como el combate lee `atk`/`def`/
  `hp` de la pieza, **no hace falta tocar `computeMoveDamage`/`effectiveAtk/Def`**: escalar
  una sola vez al crear evita doble escalado y mantiene el terreno como multiplicador aparte.

**Nota:** a Lv.1 el resultado es idéntico al anterior (multiplicador 1), así que las partidas
de draft/local no cambian; solo las instancias de nivel >1 (equipos por `ownedId`) pegan y
aguantan más.

**Verificación:** [`test/progression.test.ts`](../services/game-service/test/progression.test.ts)
— Lv.1 = base; monotonía por nivel; saturación en `[1,100]`; `scaledVitals` (hp lleno,
atk/def crecen). game-service **94/94**, `tsc` limpio.
