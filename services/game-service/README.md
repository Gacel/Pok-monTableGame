# game-service

Núcleo autoritativo del juego (Fastify + SQLite). Mantiene el estado del tablero
hexagonal, valida cada jugada y persiste la partida. Estructurado en **MVC**.

## Arquitectura (MVC)

```
src/
├── engine/        Lógica PURA y testeable (sin HTTP ni DB):
│   ├── hex.ts         coordenadas axiales, vecindad, distancia
│   ├── board.ts       tablero, losetas (bioma), ocupantes (Pokemon)
│   ├── movement.ts    patrones (FLYING/TANK/SPEEDSTER) → movimientos y ataques
│   ├── combat.ts      combate por turnos determinista
│   ├── environment.ts ventaja de tipo + modificadores de terreno
│   ├── resources.ts   economía por bioma (Catan)
│   └── mapLoader.ts   carga de mapas Tiled → Board
├── models/        MODELO: acceso a datos SQLite
│   ├── db.ts          conexión + migraciones (incl. tablas moves, pokemon_moves)
│   ├── UserModel.ts   PokemonModel.ts   MatchModel.ts   MoveModel.ts
├── services/      DOMINIO/orquestación
│   ├── GameService.ts     partida autoritativa (turnos, combate, recursos)
│   ├── MatchManager.ts    ciclo de vida + persistencia
│   └── PokemonService.ts  plantillas (caché SQLite → PokeAPI)
├── controllers/   CONTROLADOR: Auth, User, Game (validan input, delegan)
├── routes/        registro de endpoints con schemas Fastify
├── app.ts         construye Fastify
└── server.ts      boot + graceful shutdown (persiste estado en SIGTERM)
```

## Contrato HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/health` | Healthcheck (`{status:'ok'}`) |
| GET  | `/api/game/state` | Estado completo de la partida (tiles, turno, jugador, recursos, log, ganador) |
| GET  | `/api/game/board` | Solo el array de losetas (compatibilidad) |
| GET  | `/api/game/moves?q&r` | Movimientos y ataques legales de la pieza en `(q,r)` |
| POST | `/api/game/move` | `{from:{q,r}, to:{q,r}}` → valida y aplica; `400` si es ilegal |
| POST | `/api/game/combat/action` | Acción de combate: `{action, moveName?}`. `action` ∈ `ATACAR·HABILIDAD·OBJETO·HUIR·MOVE`. `MOVE` usa un ataque real: `{action:'MOVE', moveName:'ember'}` |
| POST | `/api/game/combat/continue` | Cierra la fase de resultado del combate |
| POST | `/api/game/start` | Partida LOCAL: `{player1..player4?: string[3], gameMode?: 'ffa'\|'teams'}` (2-4 jugadores; `teams` = 2v2, exige 4) |
| POST | `/api/game/reset` | Reinicia la partida por defecto |
| POST | `/api/auth/login` | *(transición)* `{email}` → token + user (mock) |
| POST | `/api/auth/register` | *(transición)* `{token,username,avatarUrl}` |
| GET  | `/api/users/me` | *(transición)* perfil por `Authorization: Bearer <token>` |

### Lobby multijugador ONLINE

Crear partida como **anfitrión** (con nombre) y **buscar partida** desde otro
navegador. Identidad por `Authorization: Bearer <token>` (mock actual: el token
es el userId; se sustituirá por JWT). Tipos compartidos en `@transcendence/shared`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/api/lobby/matches` | `{name, capacity: 2-4, gameMode: 'ffa'\|'teams'}` → crea sala `waiting` (Bearer) |
| GET    | `/api/lobby/matches` | Lista de salas abiertas (`LobbySummary[]`) |
| GET    | `/api/lobby/matches/:id` | Estado de la sala (`RoomInfo`, con `youAre` según token) |
| POST   | `/api/lobby/matches/:id/join` | Unirse a la sala (Bearer); `409` si llena/empezada |
| POST   | `/api/lobby/matches/:id/team` | `{team: string[3]}` del draft; al completarse todos → partida `active` |
| DELETE | `/api/lobby/matches/:id` | Cerrar sala (solo anfitrión, solo `waiting`) |

Acciones de partida online (mismas de arriba con guard de identidad — cada
jugador SOLO actúa como su propio slot): `GET/POST /api/game/:matchId/(state |
moves | move | combat/action | combat/continue | end-turn | abandon)`.

### WebSocket

`GET /ws` — sala local hot-seat (comportamiento clásico).
`GET /ws?matchId=<id>&token=<token>` — sala online: al conectar recibe
`{type:'room'}` (+ `{type:'state'}` si la partida existe); el servidor difunde
`state`/`room`/`room_closed`/`chat` SOLO dentro de la sala. Si el anfitrión se
desconecta en `waiting` >30 s, la sala se cierra; las salas inactivas se barren
a los 30 min.

> Las rutas `auth`/`users` son **provisionales** hasta que existan `auth-service` y
> `user-service` como microservicios propios (ver `docs/ARCHITECTURE.md`).

## Modelo de juego

- **Movimiento** por patrón: `FLYING` (alfil/diagonales), `TANK` (rey/adyacente),
  `SPEEDSTER` (caballo/saltos en L), adaptados a la malla hexagonal.
- **Terreno**: `FIRE` da +20% ATK a fuego y −15% DEF a planta; el río (`WATER`)
  bloquea a los Pokémon de fuego.
- **Combate**: al atacar a un enemigo alcanzable se resuelve por turnos con ventaja
  de tipo (FIRE>GRASS>WATER>FIRE); el vencedor ocupa la casilla.
- **Ataques (moves)**: cada Pokémon lleva ≤4 ataques reales importados y curados de
  PokeAPI (tablas `moves`/`pokemon_moves`). Los especiales cuestan 1 candy del tipo
  del ataque; los físicos son gratis. La ventaja de tipo la aporta el **tipo del
  movimiento**. Detalle en `docs/MOVES_SYSTEM.md`.
- **Recursos** (Catan): cada turno, cada Pokémon genera el "candy" de su bioma.
- **Victoria**: quedarse sin Pokémon en el tablero.

## Variables de entorno

| Variable | Por defecto | Uso |
|----------|-------------|-----|
| `PORT` | `3001` | Puerto de escucha |
| `HOST` | `0.0.0.0` | Interfaz |
| `LOG_LEVEL` | `info` | Nivel de logs (pino) |
| `GAME_DB_PATH` | `data/game.db` | Ruta del SQLite |
| `GAME_MAP_PATH` | `data/sample_map.json` | Mapa Tiled a cargar |

## Desarrollo y tests

```bash
npm run dev     # tsx watch src/server.ts
npm test        # vitest (motor + integración de GameService)
```

Sin Node en el host, usa Docker (ver `docs/LOCAL_DEV.md`).
