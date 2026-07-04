# ARCHITECTURE.md — Transcendence Pokémon Edition

> Documento vivo. Describe la arquitectura **objetivo** (según `CLAUDE.md`) y el
> **estado real** del código, marcando la brecha entre ambos. Se actualiza a medida
> que los componentes pasan a "Done".

---

## 1. Vista de alto nivel

```
                         ┌──────────────────────────┐
        HTTPS / WSS       │      Nginx API Gateway    │   (443, SSL self-signed)
  navegador ───────────▶ │  reverse proxy + (WAF)    │
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

El **servidor es la única fuente de verdad**. El cliente solo renderiza estado y
envía intenciones (movimientos); nunca calcula reglas de juego.

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
| `auth-service` | JWT, OAuth2, 2FA · SQLite | ⚠️ **No existe aún.** Rutas `/api/auth` servidas provisionalmente por `game-service` con login mock. |
| `user-service` | Perfiles, amigos, stats · SQLite | ⚠️ **No existe aún.** `/api/users/me` servido provisionalmente por `game-service`. |
| `game-service` | Lógica de juego, combate, WSS · SQLite | 🟧 En curso. Motor hex + persistencia SQLite. Refactor a MVC en progreso. |
| `pokeapi-proxy` | Fetch + transform + caché Redis | ⚠️ No existe. El frontend consulta `pokeapi.co` directamente (a migrar). |
| `status-service` | Presencia · SQLite | ⬜ Pendiente. |
| `mail-service` | Correos async · SQLite | ⬜ Pendiente. |
| `gateway` (Nginx) | Entrada única, SSL, WAF | 🟧 Nginx + SSL OK. WAF (ModSecurity) pendiente. |
| `frontend` | SPA TS + Tailwind | 🟧 En curso (Vite + TS + Tailwind v4). |

> **Nota de transición:** hasta que `auth-service` y `user-service` existan como
> servicios independientes, `game-service` expone temporalmente esas rutas para
> mantener el juego funcional end-to-end. El gateway enruta en consecuencia.
> Ver `docs/AUTONOMOUS_SESSION.md` para el registro de decisiones.

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
> persistente: ver `docs/PROGRESSION.md`.

Persistencia: el estado del tablero se serializa a JSON y se guarda al final de
cada turno y ante `SIGTERM` (graceful shutdown, C4.2).

**Ataques (moves):** `moves` es el catálogo deduplicado de movimientos importados de
PokeAPI y `pokemon_moves` el learnset de cada Pokémon (índice
`idx_pokemon_moves_pokemon`). Al crear una partida, `PokemonService.getCuratedMoves()`
elige ≤4 ataques por Pokémon y los cachea aquí; solo la primera partida paga red.
Detalle completo en `docs/MOVES_SYSTEM.md`. *(A futuro, este fetch/caché debe migrar
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

- **REST** síncrono para acciones puntuales (login, crear partida, mover en MVP).
- **WSS** para sincronización de tablero y chat en tiempo real (C2.8).
- **RabbitMQ** para eventos asíncronos entre servicios (`PokemonEvolved`,
  `mail.send`, presencia) — pendiente de integrar.

---

## 7. Seguridad (resumen; detalle en futuro `SECURITY_CHECKLIST.md`)

- HTTPS + WSS estrictos (certs self-signed en local).
- Validación y sanitización **server-side** en cada ruta Fastify antes de tocar SQLite.
- **JWT firmado (implementado):** `signup`/`login`/`google` emiten un JWT (`jsonwebtoken`,
  secreto en `JWT_SECRET`). Un hook `onRequest` global exige JWT en **todos** los
  endpoints salvo la allowlist (`/health`, `/api/auth/signup`, `/api/auth/login`,
  `/api/auth/google/*`). `/ws` verifica el token por query string dentro del handler.
  Ver `services/game-service/src/auth/jwt.ts`, `app.ts` (hook) e `identity.ts`.
  Usuarios persistidos en SQLite con `email` (registro real; `login` solo cuentas
  existentes, `signup` crea).
- Secretos desde Vault (pendiente): `JWT_SECRET` hoy sale de `.env` dev (placeholder);
  migrar a Vault (C1.1). Nada sensible real en `.env`.
- WAF ModSecurity en el gateway (pendiente).

---

## 8. Verificación local (sin Node en el host)

El host de desarrollo puede no tener Node instalado. La verificación se hace
íntegramente vía Docker:

- **Typecheck:** contenedor `node:20-alpine` con el repo montado, `npx tsc --noEmit`.
- **Tests:** se copia el servicio a un fs Linux del contenedor y se ejecuta `vitest`.
- **Stack completo:** `make up` (docker compose).

Ver `docs/LOCAL_DEV.md` y `docs/AUTONOMOUS_SESSION.md`.
