# Plan de refactor — Seguridad + Arquitectura MVC

> Rama: `refactor/security-mvc-audit`. Este documento traza el plan y su estado.
> Verificación por fase: `tsc --noEmit` por servicio (verde) + tests en Docker en el
> checkpoint final. Ver `SECURITY_AUDIT.md` y `ARCHITECTURE_AUDIT.md` para el detalle.

## Nota de gobernanza
Estos cambios son de programación. Según la política de la organización, conviene
consultarlos con tu responsable antes de fusionarlos. Si surgen dificultades, el canal
**Preguntas y Respuestas** del grupo de Teams de ZIENworkers está para pedir ayuda.

## Orden de ejecución (por dependencias)

| Fase | Contenido | Riesgo | Estado |
|------|-----------|--------|--------|
| 1 | Contratos en `packages/shared` + unificar enums; `frontend/models/Types.ts` como barrel | Alto (churn) | ✅ Hecho |
| 2 | Auth: password (scrypt) + 2FA scaffold + UUID + JWT hardening + cookie HttpOnly + unificar identidad | Alto (UX/login) | ✅ Hecho |
| 3 | `GameActionService` + `EconomyService` + helper `utils/hex` | Medio | ✅ Hecho |
| 4 | Descomponer `MatchManager` (Factory/Repository/Arena) + desacoplar `RoomService` del `hub` | Alto | ⏳ Diferido |
| 4b | Tests de `loot.ts` | Bajo | ✅ Hecho |
| 5 | Frontend `net/PokeSprites` (caché, dedup ×6) | Medio | ✅ Hecho |
| 5b | Frontend `net/*Api` (FriendsApi/LobbyApi/ShopApi…) | Medio | ⏳ Diferido |
| 6 | Frontend `utils/html|trainer|theme` + fix XSS + escape unificado | Bajo | ✅ Hecho (wiring de colores parcial) |
| 7 | Frontend descomponer `GameController` + Router/HubStore | Medio | ⏳ Diferido |
| 8 | CSP + cabeceras de seguridad en `gateway/nginx.conf` | Bajo | ✅ Hecho |
| 9 | Verificación (typecheck ✅ ambos servicios + 39/39 tests en Docker ✅) | — | ✅ Hecho |

## Diferido (alto valor, requiere bucle de test de integración)
Estos dos son descomposiciones grandes de "God objects" cuyo riesgo obliga a poder
ejecutar el juego end-to-end para validarlas; se dejan documentadas con camino claro:
- **Backend**: partir `MatchManager` en `MatchFactory`/`MatchRepository`/`ArenaService` y
  desacoplar `RoomService`/`MatchManager` del `hub` (inyección de un `Broadcaster`).
- **Frontend**: partir `GameController` (Controller + CameraController + InputController +
  `GameApi`), extraer `net/*Api` del hub y añadir Router/`HubStore` observable.

## Contratos objetivo en `packages/shared`
- `domain.ts`: `Hex`, `PokemonType`, `Biome`, `MovementPattern`, `Pokemon`, `Tile`, `PokemonMove`.
- `match.ts`: `MatchStateDTO`, `CombatState`, `PlayerResources`, `MoveOptions`.
- Enums unificados a **MAYÚSCULAS** (lo que persiste la BD y el motor).
- `ws.ts`: `WsServerMessage.state: MatchStateDTO` (en vez de `unknown`).

## Cambios de producto introducidos por la auth
- El login pasa a exigir **contraseña**. Usuarios existentes (creados sin contraseña)
  necesitan flujo de establecer contraseña o recrearse. Documentado en `docs/AUTH.md`.
- El JWT viaja en **cookie HttpOnly+Secure+SameSite**; el frontend deja de leerlo de
  `localStorage`. `apiFetch` usa `credentials: 'include'`.

## Fuera de alcance (documentado, no aplicado)
- Integración con **HashiCorp Vault** (hoy secretos por env; abortará si faltan).
- **Rate limiting** (`@fastify/rate-limit`) y límites de payload/throttle en WS.
- **Migraciones versionadas** en `src/db/migrations` (hoy inline defensivas).
- Auto-hospedaje de la fuente y enrutado de PokeAPI por `pokeapi-proxy` + Redis.

## Registro de progreso
(Se actualiza al cerrar cada fase.)
