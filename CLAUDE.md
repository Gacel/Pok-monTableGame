# CLAUDE.md — Transcendence Pokémon Edition

> Contexto persistente para Claude (Antigravity). Léelo al inicio de cada sesión.
> Objetivo: construir **ft_transcendence Pokémon Edition** componente a componente,
> probando todo en **local con Docker** (cada microservicio, BD, frontend y backend
> levantados por separado).

---

## 1. Qué estamos construyendo

Una **SPA** sobre una **arquitectura de microservicios desacoplados** que fusiona:

- **Pong** (base jugable) + **Catan** (control de losetas → recursos) +
  **Ajedrez** (patrones de movimiento) + **Pokémon** (tipos, combate, evolución).
- Tablero **hexagonal** con estado **autoritativo en servidor**, sincronizado por **WebSockets (wss)**.
- Estética **8-bit / retro** (sprite sheets, bitmaps).

El servidor es la **única fuente de verdad**: valida cada movimiento antes de
replicar estado a los clientes. Nunca confiar en el cliente.

---

## 2. Stack obligatorio (norma ft_transcendence)

| Capa | Tecnología | Regla |
|------|-----------|-------|
| Backend | **Fastify** sobre Node.js | Único framework backend permitido |
| Frontend | **TypeScript + Tailwind CSS** | Prohibido otro framework de frontend |
| Base de datos | **SQLite** | Una instancia por microservicio |
| Secretos | **HashiCorp Vault** | Prohibidos `.env` planos con credenciales reales |
| WAF | **ModSecurity** sobre Nginx | API Gateway endurecido |
| Gateway | **Nginx** | Reverse proxy + terminación SSL + balanceo |
| Mensajería async | **RabbitMQ** | Eventos (evoluciones, correos) |
| Caché | **Redis** | Caché agresiva de PokeAPI |
| Tiempo real | **WebSockets (wss)** | Sincronización de tablero y chat |
| Despliegue | **docker-compose up --build** | Lanzamiento total con un comando |
| Protocolos | **HTTPS + WSS** | Estricto, incluso en local (certs self-signed) |

> Si una decisión técnica entra en conflicto con esta tabla, **gana la tabla**.
> No introduzcas React/Vue/Angular, ni Express, ni Postgres/Mongo, ni ORMs pesados.

---

## 3. Microservicios

| Servicio | Responsabilidad | BD propia |
|----------|-----------------|-----------|
| `auth-service` | JWT, OAuth2 (Google), 2FA | SQLite |
| `user-service` | Perfiles, amigos, estadísticas | SQLite |
| `game-service` | Lógica del juego, estado de combate, WSS | SQLite |
| `pokeapi-proxy` | Fetch a pokeapi.co, transform a sprites retro, caché | Redis |
| `status-service` | Presencia (online / offline / in-game) | SQLite |
| `mail-service` | Notificaciones y códigos 2FA (async) | SQLite |
| `gateway` (Nginx) | Entrada única, SSL, WAF, routing | — |
| `frontend` | SPA TS + Tailwind | — |

Infra de apoyo: `vault`, `rabbitmq`, `redis`.

Comunicación: **REST** para llamadas síncronas entre servicios; **RabbitMQ**
para eventos asíncronos; **WSS** para tiempo real cliente↔game-service.

---

## 4. Estructura del monorepo (objetivo)

```
transcendence/
├── docker-compose.yml            # orquestación total
├── docker-compose.override.yml   # ajustes solo-dev (hot reload, puertos)
├── .env.example                  # SOLO variables no sensibles / punteros a Vault
├── Makefile                      # atajos: make up / make down / make logs s=auth
├── CLAUDE.md
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── LOCAL_DEV.md
│   └── ARCHITECTURE.md
├── gateway/                      # Nginx + ModSecurity (OWASP CRS) + certs
├── infra/
│   ├── vault/                    # config + script de bootstrap de secretos
│   ├── rabbitmq/
│   └── redis/
├── packages/
│   └── shared/                   # tipos TS, contratos de eventos, utilidades comunes
└── services/
    ├── auth-service/
    ├── user-service/
    ├── game-service/
    ├── pokeapi-proxy/
    ├── status-service/
    ├── mail-service/
    └── frontend/
```

Cada servicio incluye: `Dockerfile`, `package.json`, `tsconfig.json`,
`src/`, `test/`, y un `README.md` corto con su contrato (rutas/eventos).

---

## 5. Reglas de trabajo (cómo quiero que construyas)

1. **Un componente a la vez.** Sigue el orden de `docs/01-IMPLEMENTATION_PLAN.md`
   (índice completo de documentación en `docs/README.md`).
   No empieces un componente si sus dependencias no están "Done".
2. **Cada componente termina ejecutable y probado en local con Docker.**
   No se avanza con un servicio que no arranca o no pasa su smoke test.
3. **Servidor autoritativo.** Validación y sanitización **en Fastify** (lado
   servidor) antes de tocar SQLite. Nunca confíes en input del cliente.
4. **Secretos solo desde Vault.** En código se leen de Vault/variables inyectadas,
   nunca hardcodeadas ni commiteadas.
5. **TypeScript estricto** (`"strict": true`). Sin `any` salvo justificación.
6. **Tests** mínimos por componente: unit para lógica pura (motor hex, movimiento,
   combate), smoke/integración para servicios (healthcheck + ruta clave).
7. **Contratos compartidos** en `packages/shared` (tipos de eventos y DTOs) para
   que servicios no se desincronicen.
8. **Commits pequeños y atómicos**, uno por subcomponente, mensaje claro
   (`feat(auth): jwt issue/verify`).
9. **No romper lo anterior.** Antes de cerrar un componente, `make up` debe seguir
   levantando todo el stack acumulado hasta ese punto.

---

## 6. Convenciones rápidas

- Node 20 LTS, ESM, Fastify v4+.
- Lint/format: ESLint + Prettier (config en raíz, heredada por workspaces).
- Variables de entorno: nombres `SCREAMING_SNAKE_CASE`. Sensibles → Vault.
- Puertos internos detrás del gateway; al exterior solo expone Nginx (443 local).
- Logs estructurados (pino, viene con Fastify). Nivel `info` en dev.
- Migraciones SQLite versionadas en `src/db/migrations` de cada servicio.

---

## 7. Definición de "Done" por componente

- [ ] Arranca con `docker-compose up --build` sin errores.
- [ ] Healthcheck verde.
- [ ] Su smoke/unit test pasa.
- [ ] No expone secretos ni `.env` con credenciales reales.
- [ ] README del servicio actualizado con su contrato.
- [ ] El stack completo acumulado sigue levantando.

---

## 8. Flujo en Antigravity

Trabaja archivo a archivo. Para cada componente del plan:
1. Lee la ficha del componente en `docs/01-IMPLEMENTATION_PLAN.md`.
2. Crea/edita solo los archivos de ese componente.
3. Levanta y prueba en local (ver `docs/02-LOCAL_DEV.md`).
4. Marca el componente como hecho y pasa al siguiente.
