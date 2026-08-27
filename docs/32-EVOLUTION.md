# 32 · Evolución (Épica 9, fiel a PokeAPI)

> Evolución de las instancias propias: **resolución** por especie (nivel/piedra/intercambio),
> **piedras** como drops y en tienda, evolución **meta** (inventario) e **in-match**. Se apoya
> en el catálogo de cadenas de PokeAPI (T5.2) y en las instancias con `ownedId`/nivel (Épica 6).
> Se extiende ticket a ticket. Vigente desde 2026-08-03.

## T9.1 — Resolución de evolución por especie

**Qué añade** ([`engine/evolution.ts`](../services/game-service/src/engine/evolution.ts), puro):
- `resolveEvolution(info, ctx)` → `{ info, target, trigger, requirement, canEvolve }`:
  dada la `EvolutionInfo` de la especie (del catálogo T5.2) y el contexto de la instancia
  (`{ level, items }`), resuelve **si puede evolucionar ya**, a **qué forma** y con **qué
  requisito**.
  - `level` → `canEvolve` si `level >= minLevel`.
  - `stone` → `canEvolve` si el objeto (p.ej. `fire-stone`) está en `items`.
  - `trade` / `other` → **no** evolucionan aquí (el intercambio es la Épica 10).
- `requirementLabel(info)` — requisito legible en español (`Nivel 16`, `Piedra Fuego`,
  `Intercambio`), con `STONE_ES` (slug PokeAPI → nombre ES de las 5 piedras Gen 1).

**Limitación conocida:** cadenas **multi-rama** (Eevee → Vaporeon/Jolteon/Flareon) toman la
**primera** rama (como `parseEvolutionChain` de T5.2). Afinar la elección de rama por piedra
queda para un follow-up.

**Verificación:** [`test/evolution.test.ts`](../services/game-service/test/evolution.test.ts)
— Charmander (nivel: solo evoluciona al llegar a 16), Vulpix (piedra: solo con `fire-stone`),
Kadabra (intercambio: no evoluciona aquí), forma final (no evoluciona), etiqueta de piedra.
game-service **121/121**, `tsc` limpio.

## T9.2 — Piedras evolutivas: drops + tienda

**Qué añade:**
- **Catálogo** ([`services/stones.ts`](../services/game-service/src/services/stones.ts)):
  las **5 piedras Gen 1** (`fire/water/thunder/leaf/moon-stone`, slug PokeAPI) como objetos
  (`owned_items`, kind `stone`), precio 3000. Etiqueta ES desde la fuente única compartida
  (`STONE_LABEL_ES`/`stoneLabelEs` en shared; `engine/evolution.STONE_ES` re-exporta de ahí).
- **Tienda** ([`ShopController`](../services/game-service/src/controllers/ShopController.ts)):
  `GET /api/shop/stones` (lista) y `POST /api/shop/stone` (compra: valida saldo, resta
  monedas, `ItemModel.add(uid,'stone',key)`). Sección **PIEDRAS EVOLUTIVAS** en
  [`ShopMenuView`](../services/frontend/src/views/hub/ShopMenuView.ts).
- **Drops** ([`EconomyService`](../services/game-service/src/services/EconomyService.ts)):
  reutiliza el **cofre-botín** — al conceder la bola de un cofre, un **35 %** de probabilidad
  de soltar además una piedra aleatoria (`ItemModel.add`).
- **Inventario** ([`InventoryView`](../services/frontend/src/views/hub/InventoryView.ts)): las
  piedras se muestran con su **sprite de item de PokeAPI** (mismo path que las bolas) y su
  etiqueta ES.

**Nota:** *usar* la piedra para evolucionar (consumirla) es **T9.3** (meta) / **T9.4** (in-match).

**Verificación:** [`test/stones.test.ts`](../services/game-service/test/stones.test.ts) —
catálogo (5 piedras, slugs, etiqueta ES, `isStone`) y acumulación en `owned_items` (kind
`stone`). game-service **123/123**, `tsc` limpio, build + contenedores OK.

## T9.3 — Evolución meta (inventario)

**Qué añade:**
- **Modelo** ([`OwnedPokemonModel.evolve(id, newForm)`](../services/game-service/src/models/OwnedPokemonModel.ts)):
  `UPDATE name` conservando id/nivel/XP.
- **Endpoints** ([`InventoryController`](../services/game-service/src/controllers/InventoryController.ts)):
  - `GET /api/inventory/pokemon/:id/evolution` → resuelve la evolución de **esa instancia**
    (`resolveEvolution` con su nivel + las piedras del inventario). Por instancia para no
    disparar N llamadas a PokeAPI al abrir el inventario.
  - `POST /api/inventory/pokemon/:id/evolve` → valida propiedad + requisito, **consume la
    piedra** si aplica (`trigger:'stone'`), `evolve(id, target)` y cachea la plantilla destino.
    Autoritativo (rechaza si no cumple, o si está en subasta/perdido).
- **Ficha** ([`PokemonDetailModal`](../services/frontend/src/views/hub/PokemonDetailModal.ts)):
  con `ownedId`, pide la evolución y muestra **✨ EVOLUCIONAR A …** (verde) si `canEvolve`, o
  el **requisito** si no. Al evolucionar: aviso, cierra y **refresca el inventario**
  (`onEvolved`). El intercambio (Kadabra…) se marca como requisito pero no evoluciona aquí.

**Verificación:** [`test/evolveModel.test.ts`](../services/game-service/test/evolveModel.test.ts)
— `evolve` cambia la especie conservando id/nivel/XP; la resolución ya está cubierta por T9.1.
game-service **124/124**, `tsc` limpio, build + contenedores OK.

## T9.4 — Evolución in-match

**Qué añade:** una pieza evoluciona **durante la batalla** gastando **candies** — los recursos
(`FIRE/WATER/GRASS_CANDY`) por fin tienen uso real.
- **Acción** `evolve` en el `GameAction` union; ruta `POST /api/game/evolve` (local) y
  `POST /api/game/:matchId/evolve` (online).
- **Resolución async** ([`GameActionService.resolveEvolve`](../services/game-service/src/services/GameActionService.ts)):
  resuelve el catálogo (`getEvolution`) + la plantilla destino (`getTemplate`, cache-first) y
  delega en el engine. Si la pieza es una **instancia propia** (`ownedId`), **persiste** la
  nueva forma en el inventario (D13: la forma persiste en ambos flujos).
- **Engine** ([`GameService.evolvePiece`](../services/game-service/src/services/GameService.ts)):
  valida turno/propiedad/`hasActed`; las evoluciones **por nivel** exigen el nivel, las de
  **piedra/intercambio** solo candies (`candyForType` mapea el tipo → caramelo, coste **4**);
  sube stats a la forma destino escaladas por nivel (**sin curar**: HP tope al nuevo maxHp),
  consume la acción del turno y emite el evento `evolve`.
- **Frontend**: hotkey **V** sobre la pieza seleccionada → `performEvolve`; el evento `evolve`
  hace un flash ✨ y el **sprite cambia solo** (lookup por nombre en `EntityView` +
  `preloadSprites`). Errores (candies/nivel) por toast.

**Verificación:** [`test/evolveInMatch.test.ts`](../services/game-service/test/evolveInMatch.test.ts)
— evoluciona gastando candies y sube stats sin curar (consume la acción); rechaza sin candies;
las de nivel exigen el nivel; no puedes evolucionar la pieza de otro; piedra/intercambio no
exigen nivel. game-service **129/129**, `tsc` limpio, build + contenedores OK.

---

**Épica 9 cerrada** (T9.1 → T9.4). Resolución fiel a PokeAPI; piedras como drops/tienda;
evolución meta (inventario, consume piedra/valida nivel) e in-match (candies), ambas
persistentes. Habilita la Épica 10 (intercambio + evoluciones por intercambio).
