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
| 1 | Contratos en `packages/shared` + unificar enums; borrar `frontend/models/Types.ts` | Alto (churn) | ⏳ |
| 2 | Auth: password (scrypt) + 2FA scaffold + UUID + JWT hardening + cookie HttpOnly + unificar `request.user` | Alto (UX/login) | ⏳ |
| 3 | `GameActionService` + `EconomyService` + helpers (`utils/hex`, `utils/http`) | Medio | ⏳ |
| 4 | Descomponer `MatchManager` (Factory/Repository/Arena) + desacoplar `RoomService` del `hub` + tests loot | Alto | ⏳ |
| 5 | Frontend `net/PokeSprites` + `net/*Api` | Medio | ⏳ |
| 6 | Frontend `utils/theme|html|trainer` + fix XSS | Bajo | ⏳ |
| 7 | Frontend descomponer `GameController` + Router/HubStore | Medio | ⏳ |
| 8 | CSP en `gateway/nginx.conf` | Bajo | ⏳ |
| 9 | Verificación final (typecheck + tests Docker) + actualizar este doc | — | ⏳ |

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
