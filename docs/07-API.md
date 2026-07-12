# API.md — Referencia de endpoints (game-service)

> Documento vivo. Todas las rutas las sirve `game-service` (transición: aún hace de
> auth/user service). Entrada por el gateway Nginx en `https://localhost`.
>
> **Autenticación:** un hook `onRequest` global exige sesión en TODAS las rutas
> salvo la allowlist. La sesión viaja en una **cookie `HttpOnly`+`Secure`+`SameSite`**
> (ya no por header `Authorization` ni por query string) — ver
> [`03-ARCHITECTURE.md` §7](03-ARCHITECTURE.md) y [`08-AUTH.md`](08-AUTH.md) para el
> detalle del modelo de auth (contraseña + 2FA).
>
> **Rutas públicas (sin sesión):** `/health`, `/api/auth/signup`, `/api/auth/login`,
> `/api/auth/google/callback`, y `/ws` (verifica la sesión dentro del handler, ya no
> por query string tras el rewrite de seguridad).

---

## Auth (`/api/auth`)

> Referencia completa (modelo, login de pruebas, migración): [`08-AUTH.md`](08-AUTH.md).

| Método | Ruta | Body | Efecto | Notas |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password, age, student42 }` | Crea cuenta, set-cookie | Público. |
| POST | `/api/auth/login` | `{ email, password, code? }` | Inicia sesión, set-cookie | `code` requerido si el usuario tiene 2FA activo. Público. |
| POST | `/api/auth/logout` | — | Limpia la cookie | |
| POST | `/api/auth/register` | `{ username, avatarUrl }` | Completa perfil | Usuario **autenticado** (id de la sesión). |
| POST | `/api/auth/2fa/setup` | — | Genera secreto TOTP | Autenticado. |
| POST | `/api/auth/2fa/enable` | `{ code }` | Verifica y activa 2FA | Autenticado. |
| GET | `/api/auth/google/callback` | — | set-cookie + redirect `/` | OAuth2 Google (scaffold). Público. |

## Usuarios (`/api/users`)

| GET | `/api/users/me` | — | `{ success, user }` (incluye `coins`, `pokemonCount`) |
| GET | `/api/users/search?q=` | — | `{ success, users: PublicUser[] }` (min 2 letras) |

## Amigos (`/api/friends`)

| GET | `/api/friends` | — | `{ friends: PublicUser[] }` (con `online`) |
| GET | `/api/friends/recommended` | — | `{ users: PublicUser[] }` (amigos de amigos) |
| GET | `/api/friends/requests` | — | `{ requests: PublicUser[] }` (entrantes) |
| POST | `/api/friends/requests` | `{ userId }` | `{ status:'requested'\|'accepted' }` | Solicitud (auto-acepta si es mutua). |
| POST | `/api/friends/requests/:fromId/accept` | — | `{ friend }` |
| POST | `/api/friends/requests/:fromId/reject` | — | `{ success }` |

## Inventario (`/api/inventory`)

| GET | `/api/inventory` | — | `{ pokemon:[{id,name,level,isStarter,acquiredVia,type,hp,atk,def}], items:[{kind,itemKey,qty}] }` |

## Starters (`/api/starters`) — primer login

| GET | `/api/starters/options` | — | `{ pick:3, options:[{name,type,hp,atk,def}] }` (12 balanceados) |
| POST | `/api/starters` | `{ names:[3] }` | `{ success }` | 3 del pool; 409 si ya eligió. |

## Tienda (`/api/shop`) — loot de pokéballs

| GET | `/api/shop/balls` | — | `{ balls:[{key,price,dist,goodChance}] }` |
| POST | `/api/shop/ball` | `{ ball }` | `{ pokemon:{name,tier}, coins }` | Valida saldo (402), resta, tira tier del pool de 200, concede. |

## Subastas (`/api/auctions`)

> Referencia completa (modos de venta, comisiones, escrow): [`09-AUCTIONS.md`](09-AUCTIONS.md).

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/auctions` | — | Subastas activas (liquida vencidas primero) |
| GET | `/api/auctions/mine` | — | Mis subastas (historial) |
| POST | `/api/auctions` | `{ kind, pokemonId?/itemKind?+itemKey?, startingPrice?, buyNowPrice?, durationHours }` | Publicar lote |
| POST | `/api/auctions/:id/bid` | `{ amount }` | Pujar |
| POST | `/api/auctions/:id/buy` | — | Comprar ya |
| POST | `/api/auctions/:id/cancel` | — | Cancelar (solo si no tiene pujas) |

## Arena (`/api/arena`) — mundo vivo persistente

| GET | `/api/arena` | — | `{ room:RoomInfo }` (crea el mundo si no existe) |
| POST | `/api/arena/join` | `{ team:[3] }` | `{ room:RoomInfo }` | Equipo del inventario propio; entra directo, máx 4. |
| POST | `/api/arena/leave` | — | `{ success }` |

## Lobby multijugador (`/api/lobby`)

| POST | `/api/lobby/matches` | `{ name, capacity, gameMode }` | `{ room }` | Crea sala (anfitrión). `gameMode: ffa\|teams\|br\|arena`. |
| GET | `/api/lobby/matches` | — | `{ matches: LobbySummary[] }` | Salas `waiting`. |
| GET | `/api/lobby/matches/:id` | — | `{ room }` |
| POST | `/api/lobby/matches/:id/join` | — | `{ room }` |
| POST | `/api/lobby/matches/:id/team` | `{ team:[3] }` | `{ room }` | Draft (roster) en 1v1/2v2; inventario propio en BR. |
| DELETE | `/api/lobby/matches/:id` | — | `{ success }` | Solo anfitrión. |

## Partida — LOCAL (`/api/game`, hot-seat)

`GET /board · /state · /moves?q&r · /roster` · `POST /start · /move · /combat/action ·
/combat/continue · /end-turn · /abandon · /reset`. Actor = `currentPlayer` (turno
compartido). No acredita monedas (sin usuarios por slot).

## Partida — ONLINE / ARENA (`/api/game/:matchId`)

`GET /:matchId/state · /:matchId/moves` · `POST /:matchId/move · /combat/action ·
/combat/continue · /end-turn · /abandon`. Autoridad por **slot del JWT**
(`OnlineGameController`). **Economía** al finalizar cada acción: +500 al killer por KO,
y al ganar un pool de `1000×perdedores` repartido entre ganadores.

## WebSocket (`/ws`)

Query `?token=<jwt>` (obligatorio) y opcional `?matchId=`:
- **sin matchId** → sala LOCAL hot-seat.
- **matchId normal** → sala de partida online/arena (acciones + chat de sala, efímero).
- **`dm:<idA>:<idB>`** → chat directo entre dos amigos; se **persiste** y al entrar se
  envía el historial (`chat_history`). Solo los dos participantes (otro → close 4403).

## Salud

| GET | `/health` | — | `{ status:'ok', service:'game-service' }` | Público. |

---

### Tipos compartidos (`packages/shared`)
`GameMode = 'ffa'|'teams'|'br'|'arena'` · `OWNED_TEAM_MODES=['br','arena']` ·
`MatchMode='local'|'online'` · `PublicUser{id,username,avatarUrl,level,online?}` ·
`RoomInfo`, `LobbySummary`, `PlayerSlot`, `MIN_PLAYERS=2`, `MAX_PLAYERS=4`,
`DRAFT_TEAM_SIZE=3`.
