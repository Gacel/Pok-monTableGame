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
