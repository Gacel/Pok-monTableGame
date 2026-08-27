# ARCHITECTURE.md — Transcendence Pokémon Edition

> Documento vivo. Describe la arquitectura **objetivo** (según `CLAUDE.md`) y el
> **estado real** del código, marcando la brecha entre ambos. Se actualiza a medida
> que los componentes pasan a "Done". Refrescado 2026-07-11 — ver
> [`docs/README.md`](README.md) para el índice completo de documentación.

---

## 1. Vista de alto nivel

### 1.1 Objetivo (según `CLAUDE.md §3`)

```
                         ┌──────────────────────────┐
        HTTPS / WSS       │      Nginx API Gateway    │   (443, SSL self-signed)
  navegador ───────────▶ │  reverse proxy + WAF      │
                         └────────────┬─────────────┘
                                      │  routing por ruta
        ┌───────────────┬────────────┼────────────┬───────────────┐
        ▼               ▼            ▼            ▼               ▼
   /  (SPA)      /api/auth      /api/users    /api/game       /api/poke
  frontend      auth-service   user-service  game-service   pokeapi-proxy
  (Vite/TS)     (Fastify)      (Fastify)     (Fastify+WSS)   (Fastify+Redis)
                     │              │             │
                     └──── SQLite ──┴──── SQLite ─┘   (una BD por servicio)

  Infra transversal:  Vault (secretos) · RabbitMQ (eventos) · Redis (caché)
```

### 1.2 Real (código a día de hoy)

```
                         ┌──────────────────────────┐
        HTTPS / WSS       │      Nginx API Gateway    │   (443, SSL self-signed)
  navegador ───────────▶ │  reverse proxy, sin WAF   │
                         └────────────┬─────────────┘
                                      │  routing por ruta
                    ┌─────────────────┼───────────────────┐
                    ▼                                      ▼
              /  (SPA)                    /api/auth · /api/users · /api/game
             frontend                              · /api/auctions · /ws
             (Vite/TS)                                  game-service
                                                     (Fastify + WSS + SQLite)

  auth-service / user-service / status-service / mail-service / pokeapi-proxy:
  NO existen como código. Vault / RabbitMQ / Redis / ModSecurity: sin implementar
  (solo volúmenes/placeholders reservados en docker-compose.yml y .env.example).
```

El **servidor es la única fuente de verdad**. El cliente solo renderiza estado y
envía intenciones (movimientos); nunca calcula reglas de juego. Esto se cumple
igual en el estado real, aunque toda la autoridad viva hoy en un único servicio.

---

## 2. Patrón Modelo–Vista–Controlador (MVC)

Este proyecto aplica MVC **en las dos capas**:

### 2.1 Backend (`game-service`, y por extensión el resto de servicios Fastify)

| Capa | Carpeta | Responsabilidad |
|------|---------|-----------------|
| **Model** | `src/models/` | Acceso a datos (SQLite vía `sqlite3`), DTOs, persistencia. Sin lógica HTTP. |
| **View** | respuestas JSON / mensajes WSS | Serialización del estado hacia el cliente. |
| **Controller** | `src/controllers/` | Traducen peticiones HTTP/WSS a llamadas de servicio; validan input. |
| **Rutas** | `src/routes/` | Registran endpoints Fastify y los enlazan a controladores. |
| **Servicios/Dominio** | `src/services/` + `src/engine/` | Lógica de juego pura y orquestación autoritativa. |

> `engine/` contiene **lógica pura y testeable** (hex, movimiento, combate,
> recursos, entorno). No conoce HTTP, ni SQLite, ni Fastify. Es el corazón
> determinista del juego y se cubre con tests unitarios.

### 2.2 Frontend (`services/frontend`)

| Capa | Carpeta | Responsabilidad |
|------|---------|-----------------|
| **Model** | `src/models/` | `GameState` (estado observable), tipos (`Types.ts`). |
| **View** | `src/views/` | `BoardView`, `EntityView`, `HUDView`, vistas de hub. Solo pintan. |
| **Controller** | `src/controllers/` | `GameController`: input del usuario, red (fetch/WSS), orquesta vistas. |

El estado del frontend es **derivado** del estado autoritativo del servidor.

---

## 3. Microservicios (objetivo vs. realidad)

| Servicio | Objetivo (`CLAUDE.md §3`) | Estado real actual |
|----------|---------------------------|--------------------|
| `auth-service` | JWT, OAuth2, 2FA · SQLite | ⚠️ **No existe como servicio propio.** Auth real (password scrypt + 2FA TOTP + JWT en cookie HttpOnly + OAuth2 Google scaffold) implementada dentro de `game-service`. Ver [`08-AUTH.md`](08-AUTH.md). |
| `user-service` | Perfiles, amigos, stats · SQLite | ⚠️ **No existe aún.** `/api/users/*` (perfil, amigos, búsqueda) servido provisionalmente por `game-service`. |
| `game-service` | Lógica de juego, combate, WSS · SQLite | ✅ Funcional. MVC completo (engine/models/services/controllers/routes), combate por turnos, WSS, recursos, subastas, economía, draft — sin tests exhaustivos. |
| `pokeapi-proxy` | Fetch + transform + caché Redis | ⚠️ No existe. El frontend y `game-service` consultan `pokeapi.co` directamente, sin Redis. |
| `status-service` | Presencia · SQLite | ⬜ Pendiente. Solo existe el tipo `PresenceStatus` en `packages/shared`, sin lógica de presencia real. |
| `mail-service` | Correos async · SQLite | ⬜ Pendiente. |
| `gateway` (Nginx) | Entrada única, SSL, WAF | 🟧 Nginx + SSL + cabeceras de seguridad (CSP, HSTS...) OK. WAF (ModSecurity) pendiente. |
| `frontend` | SPA TS + Tailwind | ✅ Funcional. Vite + TS + Tailwind: tablero, hub completo (lobby, draft, subastas, tienda, inventario, comunidad), responsive. |

> **Nota de transición:** hasta que `auth-service` y `user-service` existan como
> servicios independientes, `game-service` expone esas rutas para mantener el
> juego funcional end-to-end. El gateway enruta en consecuencia. Ver
> [`archive/AUTONOMOUS_SESSION.md`](archive/AUTONOMOUS_SESSION.md) para el
> registro histórico de esta decisión.
>
> **Sistema de evolución de Pokémon:** pese a estar en el diseño original
> (`CLAUDE.md §1`, componente C3.8), **no está implementado** — no hay ninguna
> referencia a "evolución" en el código de `game-service` ni `frontend`.

---

## 4. Modelo de datos (game-service, SQLite)

```
users(          id TEXT PK, username TEXT, avatarUrl TEXT,
                level INTEGER, coins INTEGER, created_at TEXT )

pokemons(       name TEXT PK, hp INT, maxHp INT, type TEXT,
                movementPattern TEXT, raw_data TEXT )   -- caché de PokeAPI

matches(        id TEXT PK, status TEXT, turn INTEGER,
                current_player TEXT, created_at TEXT, updated_at TEXT )

match_state(    match_id TEXT PK, state_json TEXT )     -- tablero serializado

moves(          name TEXT PK, type TEXT, power INT, accuracy INT, pp INT,
                damage_class TEXT, short_effect TEXT, raw_data TEXT )  -- catálogo PokeAPI

pokemon_moves(  pokemon_name TEXT, move_name TEXT, learn_method TEXT,
                level INT, PK(pokemon_name, move_name) )  -- learnset por Pokémon

friendships(    user_id TEXT, friend_id TEXT, PK(user_id,friend_id) )  -- amigos (bidireccional)
friend_requests(from_id TEXT, to_id TEXT, PK(from_id,to_id) )          -- solicitudes pendientes
messages(       id PK, dm_room TEXT, from_id TEXT, text TEXT, created_at )  -- chat DM persistente
owned_pokemon(  id PK, user_id TEXT, name TEXT, level INT,
                is_starter INT, acquired_via TEXT )   -- inventario Pokémon (instancia por fila)
owned_items(    user_id TEXT, kind TEXT, item_key TEXT, qty INT,
                PK(user_id,kind,item_key) )           -- inventario objetos (cosméticos/pokéballs)
```

> `users.coins` arranca en **5000**. Economía, inventario, starters y chat
> persistente: ver [`06-PROGRESSION.md`](06-PROGRESSION.md). Subastas
> (tablas propias, no listadas arriba): ver [`09-AUCTIONS.md`](09-AUCTIONS.md).

Persistencia: el estado del tablero se serializa a JSON y se guarda al final de
cada turno y ante `SIGTERM` (graceful shutdown, C4.2).

**Ataques (moves):** `moves` es el catálogo deduplicado de movimientos importados de
PokeAPI y `pokemon_moves` el learnset de cada Pokémon (índice
`idx_pokemon_moves_pokemon`). Al crear una partida, `PokemonService.getCuratedMoves()`
elige ≤4 ataques por Pokémon y los cachea aquí; solo la primera partida paga red.
Detalle completo en [`04-MOVES_SYSTEM.md`](04-MOVES_SYSTEM.md). *(A futuro, este fetch/caché debe migrar
al microservicio `pokeapi-proxy` + Redis, C3.1.)*

---

## 5. Flujo de una jugada (autoritativo)

```
1. Cliente selecciona pieza  → GameController pide movimientos legales.
2. Cliente hace clic destino → POST /api/game/move { matchId, from, to }.
3. Controller valida input (esquema) y turno.
4. GameService consulta engine/movement.getLegalMoves(): ¿legal?
      NO → 400 (rechazado, el cliente no muta nada).
      SÍ → aplica movimiento; si hay enemigo en rango → engine/combat.
5. Se recalcula estado, se colecta economía si acaba turno.
6. Se persiste match_state y se difunde `state` (WSS) / se devuelve (REST).
7. Cliente solo re-renderiza el estado recibido.
```

---

## 6. Comunicación

> **Referencia completa de endpoints:** [`07-API.md`](07-API.md).

- **REST** síncrono para acciones puntuales (login, crear partida, mover, subastas...).
- **WSS** para sincronización de tablero y chat en tiempo real (implementado, C2.8).
- **RabbitMQ** para eventos asíncronos entre servicios (`PokemonEvolved`,
  `mail.send`, presencia) — **no implementado**; no hay ningún cliente RabbitMQ en el código.

---

## 7. Seguridad

> Checklist vivo con lo resuelto y lo pendiente: [`13-SECURITY_CHECKLIST.md`](13-SECURITY_CHECKLIST.md).
> Auditoría histórica que originó el rewrite: [`archive/SECURITY_AUDIT.md`](archive/SECURITY_AUDIT.md).

- HTTPS + WSS estrictos (certs self-signed en local); CSP y cabeceras de
  seguridad activas en el gateway (`gateway/nginx.conf`).
- Validación y sanitización **server-side** en cada ruta Fastify antes de tocar SQLite.
- **Login real con contraseña (scrypt) + 2FA (TOTP) opcional**, IDs de usuario
  aleatorios (UUID). El JWT viaja en cookie `HttpOnly`+`Secure`+`SameSite` —
  ya no en `localStorage` ni por query string. `JWT_SECRET` sin fallback
  hardcodeado (el arranque aborta si falta), algoritmo fijado (HS256) con
  `aud`/`iss`. Ver [`08-AUTH.md`](08-AUTH.md) y
  `services/game-service/src/auth/{jwt,password,totp,cookie,identity}.ts`.
- Secretos desde Vault (pendiente): `JWT_SECRET` y credenciales OAuth siguen
  saliendo de `.env`/variables de entorno, no de Vault (C1.1).
- WAF ModSecurity en el gateway (pendiente).
- Rate limiting (pendiente): sin `@fastify/rate-limit` ni throttle en WS.

---

## 8. Tests y CI

- **Cobertura escasa:** 2 ficheros de test en `game-service` (`loot.test.ts`,
  `mapLoader.test.ts`) y 2 en `frontend` (`aiDraft.test.ts`, `botStrategy.test.ts`).
  Un commit reciente (`refactor(tests): remove outdated game-service tests`)
  eliminó tests obsoletos sin reemplazarlos todavía.
- **Sin CI:** no hay `.github/workflows/` ni ningún otro pipeline configurado;
  la verificación es manual vía Docker (ver abajo).

## 9. Verificación local (sin Node en el host)

El host de desarrollo puede no tener Node instalado. La verificación se hace
íntegramente vía Docker:

- **Typecheck:** contenedor `node:20-alpine` con el repo montado, `npx tsc --noEmit`.
- **Tests:** se copia el servicio a un fs Linux del contenedor y se ejecuta `vitest`.
- **Stack completo:** `make up` (docker compose).

Ver [`02-LOCAL_DEV.md`](02-LOCAL_DEV.md) y [`archive/AUTONOMOUS_SESSION.md`](archive/AUTONOMOUS_SESSION.md).
