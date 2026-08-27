# SHINY_GACHA.md — Pokémon Shiny y apertura cinemática de gacha

> Registro de dos features construidas **en paralelo** por el usuario (tickets TG.1 y TG.2
> del roadmap [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md)). Documentado a posteriori
> para dejar constancia. Vigente desde 2026-07-14.

## TG.1 — Pokémon Shiny

Los Pokémon obtenidos (tienda y cofres) pueden salir **shiny** (variante de color), con
probabilidad según la **calidad de la Pokéball**.

**Backend:**
- [`db.ts`](../services/game-service/src/models/db.ts): columna `is_shiny INTEGER NOT NULL
  DEFAULT 0` en `owned_pokemon` + migración defensiva (`ALTER TABLE … ADD COLUMN` si falta).
- [`OwnedPokemonModel.grantMany`](../services/game-service/src/models/OwnedPokemonModel.ts):
  nuevo parámetro `isShiny` (persiste `is_shiny`); `OwnedPokemonRecord.is_shiny`.
- [`ShopController`](../services/game-service/src/controllers/ShopController.ts) y
  [`InventoryController`](../services/game-service/src/controllers/InventoryController.ts)
  (abrir cofre): **probabilidad shiny por precio de bola** — base **1%**, `≥1000` → **3%**,
  `≥2000` → **7%**, `≥10000` → **20%**; se pasa `isShiny` a `grantMany` y se devuelve en la
  respuesta. El listado de inventario expone `isShiny`.

**Frontend:**
- [`net/PokeSprites.ts`](../services/frontend/src/net/PokeSprites.ts): `getSprite(name,
  isShiny)` / `getSpritePair(name, isShiny)` con la cadena de fallback de sprites **shiny**
  de PokeAPI (`front_shiny` en gen-V animado → estático → artwork → home); caché por clave
  `name-shiny`.
- [`InventoryView`](../services/frontend/src/views/hub/InventoryView.ts): sprite shiny,
  distintivo **✨** en la celda, y `isShiny` propagado a la ficha.
- [`PokemonDetailModal`](../services/frontend/src/views/hub/PokemonDetailModal.ts): **✨** en
  el título y sprite shiny.

## TG.2 — Apertura cinemática de gacha (tienda) + audio

Al comprar/abrir una Pokéball, se reproduce una **secuencia cinemática** con tensión y
revelado, con dramatismo por **tier** (rareza) y por **shiny**.

- [`ShopMenuView`](../services/frontend/src/views/hub/ShopMenuView.ts): máquina de estados
  `root → balls → opening → sky_cinematic → fullscreen_reveal → reveal`. La pokéball
  tiembla y "explota-zoom"; escena sideral (nebulosa `organic-nebula`, `starfield`,
  **meteoritos** con trayectorias zigzag y color por tier), flash, revelado a pantalla
  completa y ficha final. Usa `getSprite(name, isShiny)` para el sprite revelado.
- [`GachaAudio`](../services/frontend/src/views/hub/GachaAudio.ts) (nuevo): motor de audio
  con **Web Audio API** (síntesis en vivo): `playTension`, `playMeteor`, `playEpicSky`,
  `playExplosion`, `playVictory(tier)` (melodía por rareza) + reproducción de pistas
  (`playTrack`/`stopTrack`). Assets: `public/assets/sounds/catch.mp3`, `victory.mp3`.
- [`style.css`](../services/frontend/src/style.css): keyframes de la secuencia
  (`pokeball-explode-zoom`, `magic-bg-explode`, `organic-nebula`, `sky-pan-up`,
  `meteor-zigzag-1/2`, `gacha-flash`, `animate-gacha-shake`…).

## Estado y notas

- **Compilación:** al integrar se remataron 3 errores de tsc pendientes del WIP: `isShiny`
  en la interfaz `InvPokemon`, un parámetro `tier` sin usar en `spawnMeteors` (→`_tier`) y
  una llamada `navigate('/hub/shop')` inexistente (eliminada; `render()` ya rehace la vista).
- `tsc` limpio (frontend + game-service), tests 17/17 y 46/46, build de producción del
  frontend OK.
- Script de depuración `services/game-service/db_check.mjs` (vuelca el esquema de la BD
  local; ruta absoluta hardcodeada) **no se versiona**: es una utilidad puntual.

## Pendiente / futuro

- Distintivo shiny también en el **tablero de combate** (hoy el sprite shiny se usa en el
  hub/tienda; en partida el equipo se envía por nombre — la instancia/forma llegará con
  T6.3 "equipos por instancia").
- Sonido de click/UI unificado y control de volumen/mute.
