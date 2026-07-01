# IMPLEMENTATION_PLAN.md — Transcendence Pokémon Edition

> Roadmap **componente a componente** para construir en Antigravity con pruebas
> locales en Docker. Sigue el orden: cada componente depende de los anteriores.
> Lee primero `CLAUDE.md` (stack, reglas y "Done").

**Cómo usar este plan:** por cada componente, copia el bloque **"Prompt para Claude"**
en Antigravity, déjalo trabajar solo sobre los archivos de ese componente, levántalo
en local y verifícalo con sus **Criterios de aceptación** antes de pasar al siguiente.

**Leyenda de estado:** ⬜ pendiente · 🟧 en curso · ✅ hecho.

---

## Mapa de dependencias (orden de construcción)

```
FASE 0  Cimientos del repo
  C0.1 Monorepo & tooling
  C0.2 Docker base & compose
  C0.3 Nginx gateway (sin WAF aún)
        │
FASE 1  Seguridad & Auth  (Sprint 1)
  C1.1 Vault ── C1.2 ModSecurity ── C1.3 Auth(base) ── C1.4 JWT
                                        │
                                        ├── C1.5 OAuth2 Google
                                        ├── C1.6 2FA (TOTP)
                                        └── C1.7 Mail service (async)
        │
FASE 2  Comunicación & Core de juego  (Sprint 2)
  C2.1 RabbitMQ ── C2.2 Game service(base)
  C2.3 Motor hex ── C2.4 Movimiento ── C2.5 Recursos(Catan)
                         │
  C2.6 Modificadores ambientales ── C2.7 Combate por turnos
  C2.8 WSS (sync + chat) ── C2.9 Status service
        │
FASE 3  Datos & Frontend  (Sprint 3)
  C3.1 PokeAPI proxy + Redis ── C3.2 User service
  C3.3 SPA scaffold ── C3.4 Auth UI ── C3.5 Draft UI
  C3.6 Render tablero + WSS client ── C3.7 Recursos/biomas UI ── C3.8 Evolución
        │
FASE 4  IA & Hardening  (Sprint 4)
  C4.1 IA oponente ── C4.2 Graceful shutdown + persistencia
  C4.3 Auditoría seguridad + WAF tuning ── C4.4 Pruebas de carga
```

---

# FASE 0 — Cimientos del repo

### ⬜ C0.1 — Monorepo & tooling
- **Objetivo:** estructura de carpetas, workspaces y configuración base compartida.
- **Depende de:** —
- **Entregables:**
  - Árbol de carpetas de `CLAUDE.md §4`.
  - `package.json` raíz con workspaces (`services/*`, `packages/*`).
  - `tsconfig.base.json`, ESLint + Prettier, `.editorconfig`, `.gitignore`.
  - `packages/shared` vacío con su `package.json` y `index.ts`.
  - `Makefile` con targets placeholder (`up`, `down`, `logs`, `ps`).
- **Probar en local:** `npm install` en raíz instala todos los workspaces sin error.
- **Criterios de aceptación:** `tsc --noEmit` pasa en raíz; lint sin errores.
- **Prompt para Claude:**
  > Crea el monorepo de Transcendence según `CLAUDE.md §4`: workspaces npm para
  > `services/*` y `packages/*`, `tsconfig.base.json` con `strict:true`, ESLint+Prettier
  > en la raíz heredados por los workspaces, `.gitignore`, `.editorconfig` y un `Makefile`
  > con targets `up/down/logs/ps`. Crea `packages/shared` con `package.json` e `index.ts`.
  > No crees servicios todavía. Verifica con `npm install` y `tsc --noEmit`.

### ⬜ C0.2 — Docker base & compose
- **Objetivo:** orquestación mínima que arranca con un comando.
- **Depende de:** C0.1
- **Entregables:**
  - `docker-compose.yml` con red `transcendence-net`, volúmenes nombrados.
  - `docker-compose.override.yml` para dev (hot reload, mapeo de puertos).
  - `.env.example` (solo no sensibles).
  - Servicio "hello" temporal (un Fastify mínimo) para validar el pipeline.
- **Probar en local:** `docker-compose up --build` levanta el servicio hello; responde 200.
- **Criterios de aceptación:** `make up` levanta; `make down` limpia; healthcheck verde.
- **Prompt para Claude:**
  > Crea `docker-compose.yml` + `docker-compose.override.yml` con una red bridge
  > `transcendence-net` y volúmenes nombrados. Añade un servicio temporal `hello`
  > (Fastify mínimo en `services/_hello`) con healthcheck en `/health`. Conecta los
  > targets del `Makefile`. Verifica con `make up` y `curl` al healthcheck.

### ✅ C0.3 — Nginx API Gateway (sin WAF todavía)
- **Objetivo:** entrada única con SSL local y routing por rutas.
- **Depende de:** C0.2
- **Entregables:**
  - `gateway/` con Nginx, certs self-signed para `localhost` (script de generación).
  - Routing: `/api/auth/*`, `/api/users/*`, `/api/game/*`, `/api/poke/*`, `/ws`, `/` (frontend).
  - Por ahora todas las rutas apuntan al servicio `hello` o devuelven 502 controlado.
- **Probar en local:** `https://localhost` responde por HTTPS (cert self-signed).
- **Criterios de aceptación:** terminación SSL OK; reverse proxy enruta al menos una ruta.
- **Prompt para Claude:**
  > Crea el servicio `gateway` (Nginx) en compose: terminación SSL con certs self-signed
  > para `localhost` (incluye script `gateway/gen-certs.sh`), reverse proxy con bloques
  > `location` para `/api/auth`, `/api/users`, `/api/game`, `/api/poke`, `/ws` y `/`.
  > Apunta las rutas existentes al servicio `hello`. Verifica `https://localhost/health`.

---

# FASE 1 — Seguridad & Auth (Sprint 1)

### ⬜ C1.1 — HashiCorp Vault (local dev)
- **Objetivo:** gestión central de secretos; nada sensible en `.env`.
- **Depende de:** C0.2
- **Entregables:**
  - Servicio `vault` en compose (modo dev local con token raíz fijo solo-dev).
  - `infra/vault/bootstrap.sh`: crea KV `secret/transcendence/*` (jwt, oauth, smtp…).
  - `packages/shared/vault.ts`: cliente que lee secretos al boot de cada servicio.
- **Probar en local:** un servicio arranca y lee un secreto de prueba desde Vault.
- **Criterios de aceptación:** ningún secreto real en repo; lectura desde Vault OK.
- **Prompt para Claude:**
  > Añade `vault` (dev mode) al compose con un token raíz solo-dev en `.env.example`.
  > Crea `infra/vault/bootstrap.sh` que cargue secretos KV bajo `secret/transcendence/`
  > (placeholders para jwt, google_oauth, smtp). Implementa `packages/shared/vault.ts`
  > con `getSecret(path)`. Demuestra que un servicio lee un secreto al arrancar.

### ⬜ C1.2 — ModSecurity WAF en el gateway
- **Objetivo:** endurecer Nginx como WAF (OWASP CRS).
- **Depende de:** C0.3
- **Entregables:**
  - Imagen Nginx con ModSecurity + OWASP Core Rule Set.
  - Reglas base anti-inyección; logging de eventos bloqueados.
  - Modo `DetectionOnly` configurable por env para no romper desarrollo.
- **Probar en local:** una petición con payload de inyección típica queda registrada/bloqueada.
- **Criterios de aceptación:** WAF activo; tráfico legítimo no se rompe.
- **Prompt para Claude:**
  > Reconstruye el `gateway` sobre una imagen Nginx con ModSecurity + OWASP CRS.
  > Activa reglas anti-inyección con `SecRuleEngine` conmute entre `On`/`DetectionOnly`
  > por variable de entorno. Verifica con una petición maliciosa de prueba que se loguea.

### ⬜ C1.3 — Auth Service (base, Fastify + SQLite)
- **Objetivo:** registro/login con almacenamiento seguro.
- **Depende de:** C1.1
- **Entregables:**
  - `services/auth-service` Fastify + SQLite (migración `users`).
  - `POST /register`, `POST /login` con hashing (argon2/bcrypt).
  - Validación y sanitización server-side de inputs.
- **Probar en local:** registrar y loguear un usuario por la API vía gateway.
- **Criterios de aceptación:** contraseñas hasheadas; validación rechaza inputs inválidos.
- **Prompt para Claude:**
  > Crea `services/auth-service` (Fastify + SQLite). Migración `users(id,email,pass_hash,
  > created_at)`. Rutas `POST /register` y `POST /login` con hashing argon2 y validación
  > de esquema (Fastify schema). Lee el secreto de pepper desde Vault. Enruta `/api/auth`
  > en el gateway. Verifica registrando y logueando un usuario.

### ⬜ C1.4 — JWT (issue/verify) + middleware compartido
- **Objetivo:** sesiones stateless y middleware de auth reutilizable.
- **Depende de:** C1.3
- **Entregables:**
  - Emisión de access + refresh tokens; rotación de refresh.
  - `packages/shared/auth.ts`: verificador JWT para todos los servicios.
  - Secreto de firma leído desde Vault.
- **Probar en local:** endpoint protegido devuelve 401 sin token y 200 con token válido.
- **Criterios de aceptación:** verificación consistente entre servicios; expiración correcta.
- **Prompt para Claude:**
  > Añade JWT al `auth-service`: access (15m) + refresh (7d) con rotación, firma con
  > secreto de Vault. Crea `packages/shared/auth.ts` con `verifyJwt()` y un hook Fastify
  > `requireAuth`. Protege una ruta de ejemplo. Verifica 401/200 según token.

### ⬜ C1.5 — OAuth 2.0 (Google Sign-in)
- **Objetivo:** login federado con Google.
- **Depende de:** C1.4
- **Entregables:** flujo OAuth2 (redirect + callback), vinculación a usuario, credenciales en Vault.
- **Probar en local:** flujo completo en sandbox de Google (o mock configurable).
- **Criterios de aceptación:** usuario OAuth queda en SQLite y recibe JWT propio.
- **Prompt para Claude:**
  > Implementa Google OAuth2 en `auth-service`: `GET /oauth/google` y `/oauth/google/callback`,
  > client_id/secret desde Vault, crea/vincula usuario y emite JWT. Incluye un modo mock
  > para test local sin credenciales reales. Verifica el flujo callback→JWT.

### ⬜ C1.6 — 2FA (TOTP)
- **Objetivo:** segundo factor por TOTP/código.
- **Depende de:** C1.4, (C1.7 para envío por correo)
- **Entregables:** activar/desactivar 2FA, generación QR TOTP, verificación en login.
- **Probar en local:** login pide segundo factor cuando 2FA está activo.
- **Criterios de aceptación:** login sin 2FA correcto falla; con código válido pasa.
- **Prompt para Claude:**
  > Añade 2FA TOTP a `auth-service`: `POST /2fa/enable` (devuelve secret+QR),
  > `POST /2fa/verify`, y paso intermedio en `login` cuando esté activo. Usa una
  > librería TOTP estándar. Verifica el flujo enable→login con código.

### ⬜ C1.7 — Mail Service (async vía RabbitMQ)
- **Objetivo:** envío asíncrono de correos (códigos 2FA, notificaciones).
- **Depende de:** C1.1, C2.1 (RabbitMQ) — *se puede adelantar RabbitMQ aquí*
- **Entregables:** `services/mail-service` que consume cola `mail.send`; SMTP desde Vault; MailHog en dev.
- **Probar en local:** publicar evento `mail.send` y ver el correo en MailHog.
- **Criterios de aceptación:** consumo async robusto; reintentos ante fallo.
- **Prompt para Claude:**
  > Crea `services/mail-service` que consuma la cola `mail.send` de RabbitMQ y envíe
  > por SMTP (credenciales de Vault). Añade **MailHog** al compose para capturar correos
  > en dev. Verifica publicando un `mail.send` y viéndolo en la UI de MailHog.

---

# FASE 2 — Comunicación & Core de juego (Sprint 2)

### ⬜ C2.1 — RabbitMQ (broker + contratos de eventos)
- **Objetivo:** bus de eventos asíncronos entre servicios.
- **Depende de:** C0.2
- **Entregables:** servicio `rabbitmq` (con management UI), `packages/shared/events.ts` con tipos de eventos.
- **Probar en local:** publicar/consumir un evento de prueba entre dos servicios.
- **Criterios de aceptación:** exchange/colas declaradas; tipos compartidos.
- **Prompt para Claude:**
  > Añade `rabbitmq:management` al compose. Crea `packages/shared/events.ts` con los
  > contratos (`MailSend`, `PokemonEvolved`, …) y un helper `publish/consume`. Demuestra
  > publish→consume entre dos servicios de prueba.

### ⬜ C2.2 — Game Service (base, Fastify + SQLite)
- **Objetivo:** esqueleto del servicio de juego y modelo de estado.
- **Depende de:** C1.4, C2.1
- **Entregables:** `services/game-service`, migraciones `matches`, `match_state`; auth con JWT compartido.
- **Probar en local:** crear partida vía API protegida y leerla.
- **Criterios de aceptación:** estado persistido en SQLite; rutas protegidas.
- **Prompt para Claude:**
  > Crea `services/game-service` (Fastify + SQLite) con migraciones `matches` y
  > `match_state` (JSON serializado del tablero). Rutas `POST /matches`, `GET /matches/:id`
  > protegidas con `requireAuth`. Enruta `/api/game` en el gateway. Verifica crear/leer partida.

### ⬜ C2.3 — Motor del tablero hexagonal (lógica pura)
- **Objetivo:** representación del tablero hex y biomas. **Lógica pura testeable.**
- **Depende de:** —  (puede desarrollarse en paralelo; se integra en C2.2)
- **Entregables:**
  - Sistema de coordenadas hex (axial/cube), vecindad, distancias.
  - Losetas con bioma (Fuego, Agua, Bosque) y ocupación.
  - Serialización/deserialización del estado.
  - **Tests unitarios** del motor.
- **Probar en local:** `npm test` en game-service (sin Docker necesario para esta lógica).
- **Criterios de aceptación:** cobertura de vecindad, distancia y serialización.
- **Prompt para Claude:**
  > Implementa en `game-service/src/engine` el tablero hexagonal con coordenadas cube/axial,
  > vecindad, distancia, y losetas con bioma (Fuego/Agua/Bosque) y ocupante. Añade
  > serializar/deserializar estado. Escribe tests unitarios de coordenadas y biomas. Sin red.

### ⬜ C2.4 — Patrones de movimiento (Ajedrez)
- **Objetivo:** movimiento por tipo, validado en servidor.
- **Depende de:** C2.3
- **Entregables:**
  - **Volador** = diagonal largo alcance (Alfil); **Tanque** = adyacente (Rey);
    **Velocista** = saltos en "L" (Caballo), adaptados a hex.
  - `getLegalMoves(pokemon, board)` + validación de movimiento.
  - Tests por patrón.
- **Probar en local:** `npm test` cubre cada patrón y casos de borde.
- **Criterios de aceptación:** movimientos ilegales rechazados; legales correctos.
- **Prompt para Claude:**
  > Añade `engine/movement.ts`: patrones Volador (diagonal largo), Tanque (adyacente) y
  > Velocista (saltos tipo caballo) adaptados a la malla hex. Expón `getLegalMoves()` y
  > `isMoveLegal()`. Tests por patrón y bordes del tablero.

### ⬜ C2.5 — Generación de recursos (Catan)
- **Objetivo:** control de loseta → recursos por turno.
- **Depende de:** C2.3
- **Entregables:** Candies/Berries por bioma controlado; acumulación por turno; tope/balance.
- **Probar en local:** simular N turnos → recursos esperados por jugador.
- **Criterios de aceptación:** recursos deterministas según ocupación de losetas.
- **Prompt para Claude:**
  > Implementa `engine/resources.ts`: al final de cada turno, cada Pokémon que controla
  > una loseta genera el recurso del bioma (Candies/Berries). Función `collectResources(state)`.
  > Tests que simulen turnos y verifiquen totales.

### ⬜ C2.6 — Modificadores ambientales
- **Objetivo:** efectos de terreno sobre stats y movimiento.
- **Depende de:** C2.3, C2.4
- **Entregables:**
  - Terreno Fuego: +20% ATK Fuego / −15% DEF Planta.
  - Río (Agua): Agua ignora penalización de movimiento; Fuego bloqueado.
  - `applyEnvironment(pokemon, tile)`.
- **Probar en local:** tests de stats efectivos y bloqueos de movimiento.
- **Criterios de aceptación:** modificadores correctos y combinables.
- **Prompt para Claude:**
  > Añade `engine/environment.ts`: terreno Fuego (+20% ATK Fuego, −15% DEF Planta) y
  > Río (Agua ignora penalización de movimiento, Fuego no puede entrar). Integra con
  > movimiento y combate. Tests de stats efectivos y bloqueos.

### ⬜ C2.7 — Combate por turnos
- **Objetivo:** resolución de combate al coincidir en casilla / rango.
- **Depende de:** C2.6
- **Entregables:** máquina de turnos, cálculo de daño con tipos y entorno, fin con un derrotado.
- **Probar en local:** simular combates con resultados deterministas.
- **Criterios de aceptación:** combate concluye siempre; respeta tipos y entorno.
- **Prompt para Claude:**
  > Implementa `engine/combat.ts`: al ocupar la misma casilla o entrar en rango, inicia
  > combate por turnos; calcula daño con stats base, ventaja de tipo y modificadores de
  > entorno; termina con un Pokémon derrotado. Tests deterministas de varios enfrentamientos.

### ⬜ C2.8 — WebSockets (wss): sync autoritativa + chat
- **Objetivo:** tiempo real con el servidor como árbitro.
- **Depende de:** C2.2, C2.4–C2.7
- **Entregables:**
  - Servidor WSS en game-service; auth del socket por JWT.
  - Mensajes: `move`, `state`, `combat`, `chat`. **El servidor valida antes de replicar.**
  - Salas por partida.
- **Probar en local:** dos clientes (script) ven el mismo estado tras un movimiento válido.
- **Criterios de aceptación:** movimiento ilegal rechazado; estado replicado a la sala.
- **Prompt para Claude:**
  > Añade WSS (`/ws`) al `game-service` con autenticación por JWT en el handshake.
  > Eventos `move/state/combat/chat`, salas por `matchId`. Valida cada `move` con el motor
  > **antes** de actualizar y difundir `state`. Enruta `/ws` por el gateway (wss). Verifica
  > con dos clientes de prueba que comparten estado.

### ⬜ C2.9 — Status Service (presencia)
- **Objetivo:** estado online/offline/in-game de los usuarios.
- **Depende de:** C2.1, C2.8
- **Entregables:** `services/status-service` que escucha eventos de conexión y expone presencia.
- **Probar en local:** conectar/desconectar un usuario cambia su estado consultable.
- **Criterios de aceptación:** transiciones correctas; consulta por la API.
- **Prompt para Claude:**
  > Crea `services/status-service` (Fastify + SQLite) que consuma eventos de presencia
  > (conexión/partida) por RabbitMQ y exponga `GET /status/:userId`. Verifica transiciones
  > online→in-game→offline.

---

# FASE 3 — Datos & Frontend (Sprint 3)

### ⬜ C3.1 — PokeAPI Proxy + Redis + transform retro
- **Objetivo:** datos de Pokémon cacheados y convertidos a sprites 8-bit.
- **Depende de:** C0.2
- **Entregables:**
  - `services/pokeapi-proxy`: fetch a pokeapi.co (nombres, stats, sprites).
  - Caché **agresiva** en Redis (sin fetch redundantes).
  - Mapeo a sprite sheets / bitmaps retro.
- **Probar en local:** segunda petición igual sirve desde caché (latencia mínima).
- **Criterios de aceptación:** cache hit comprobable; datos normalizados.
- **Prompt para Claude:**
  > Crea `services/pokeapi-proxy` (Fastify) que haga fetch a pokeapi.co de nombres, stats
  > base y sprites, los normalice a un DTO retro y los cachee en Redis con TTL largo.
  > Añade `redis` al compose. Endpoint `GET /api/poke/:name`. Verifica cache hit en la 2ª llamada.

### ⬜ C3.2 — User Management
- **Objetivo:** perfiles, amigos y estadísticas.
- **Depende de:** C1.4
- **Entregables:** `services/user-service` (perfil, avatar, amigos, stats agregadas).
- **Probar en local:** crear perfil, añadir amigo, leer stats vía API.
- **Criterios de aceptación:** relaciones de amistad y stats consistentes.
- **Prompt para Claude:**
  > Crea `services/user-service` (Fastify + SQLite): perfil, amigos (solicitar/aceptar) y
  > estadísticas. Rutas `/api/users/*` protegidas con JWT. Verifica el flujo perfil+amigos+stats.

### ⬜ C3.3 — Frontend SPA scaffold (TS + Tailwind)
- **Objetivo:** base del frontend sin frameworks de UI.
- **Depende de:** C0.3
- **Entregables:** Vite + TS + Tailwind, router SPA propio, build servido por Nginx en `/`.
- **Probar en local:** la SPA carga por `https://localhost` y navega entre vistas.
- **Criterios de aceptación:** TS estricto; Tailwind activo; sin React/Vue/Angular.
- **Prompt para Claude:**
  > Crea `services/frontend`: Vite + TypeScript estricto + Tailwind, con un router SPA
  > propio (history API) y vistas placeholder (Home, Login, Lobby, Game). Sírvelo desde
  > el gateway en `/`. Verifica navegación SPA en `https://localhost`.

### ⬜ C3.4 — Auth UI
- **Objetivo:** interfaz de registro/login/2FA/OAuth.
- **Depende de:** C3.3, C1.4–C1.6
- **Entregables:** formularios validados, manejo de JWT en memoria, flujo 2FA y botón Google.
- **Probar en local:** login completo desde la UI y acceso a vista protegida.
- **Criterios de aceptación:** tokens nunca en localStorage persistente inseguro; flujos OK.
- **Prompt para Claude:**
  > Implementa la UI de auth (register/login/2FA/OAuth Google) consumiendo `auth-service`.
  > Guarda el access token en memoria y refresca con el refresh token vía cookie httpOnly.
  > Protege rutas del SPA. Verifica login→vista protegida.

### ⬜ C3.5 — Draft UI (6 de 8)
- **Objetivo:** selección de equipo desde el proxy cacheado.
- **Depende de:** C3.3, C3.1
- **Entregables:** pantalla de draft que pide 8 Pokémon al proxy y deja elegir 6.
- **Probar en local:** draft carga rápido (caché) y persiste la selección de la partida.
- **Criterios de aceptación:** exactamente 6 de 8; datos desde caché.
- **Prompt para Claude:**
  > Crea la vista Draft: pide 8 Pokémon a `/api/poke`, muestra sprites retro y permite
  > elegir 6 (valida el conteo). Envía la selección al `game-service`. Verifica con caché caliente.

### ⬜ C3.6 — Render del tablero + cliente WSS
- **Objetivo:** dibujar el tablero hex retro y conectar el tiempo real.
- **Depende de:** C3.3, C2.8
- **Entregables:** render hex con bitmaps, cliente WSS, envío de `move`, recepción de `state`.
- **Probar en local:** dos pestañas juegan la misma partida sincronizadas.
- **Criterios de aceptación:** render fiel al estado del servidor; latencia baja.
- **Prompt para Claude:**
  > Implementa el render del tablero hexagonal (canvas/CSS) con sprites retro y un cliente
  > WSS que envíe `move` y aplique `state`/`combat` recibidos. Sin lógica de juego en cliente
  > (solo render + input). Verifica dos pestañas sincronizadas.

### ⬜ C3.7 — UI de recursos/biomas
- **Objetivo:** mostrar economía y control de losetas.
- **Depende de:** C3.6, C2.5
- **Entregables:** panel de recursos (Candies/Berries), indicadores de bioma y control.
- **Probar en local:** los recursos del panel coinciden con el estado del servidor por turno.
- **Criterios de aceptación:** UI = estado autoritativo; sin cálculo local.
- **Prompt para Claude:**
  > Añade el panel de recursos y biomas leyendo del `state` del servidor: Candies/Berries
  > por jugador y control de losetas. Verifica que cuadra con la simulación de turnos.

### ⬜ C3.8 — Flujo de evolución
- **Objetivo:** evolucionar cumpliendo nivel + inversión de recursos.
- **Depende de:** C3.7, C2.1
- **Entregables:** acción de evolución (servidor valida nivel+recursos), evento `PokemonEvolved` por RabbitMQ, refresco de sprite.
- **Probar en local:** evolución solo cuando se cumplen ambos hitos; sprite actualizado.
- **Criterios de aceptación:** validación server-side; evento emitido; persistencia.
- **Prompt para Claude:**
  > Implementa evolución: `POST /api/game/evolve` valida nivel de combate **y** recursos
  > invertidos, actualiza el Pokémon, persiste y publica `PokemonEvolved` en RabbitMQ.
  > En la UI, refresca el sprite. Verifica que falla sin cumplir ambos hitos.

---

# FASE 4 — IA & Hardening (Sprint 4)

### ⬜ C4.1 — Oponente IA
- **Objetivo:** IA que simula comportamiento humano.
- **Depende de:** C2.7, C2.8
- **Entregables:** IA con **refresco de vista de 1 segundo** (no lee el estado completo en tiempo real), heurística de movimiento/combate, dificultad configurable.
- **Probar en local:** partida humano vs IA completable de principio a fin.
- **Criterios de aceptación:** IA respeta el límite de 1s de "visión"; juega de forma razonable.
- **Prompt para Claude:**
  > Implementa una IA en `game-service` que solo "observe" el estado **una vez por segundo**
  > y planifique movimientos/combate con heurísticas (control de biomas, ventaja de tipo,
  > seguridad del Pokémon). Modo dificultad. Verifica una partida completa humano vs IA.

### ⬜ C4.2 — Graceful shutdown + persistencia de turno
- **Objetivo:** no perder partidas ante reinicios/desconexiones.
- **Depende de:** C2.2, C2.8
- **Entregables:** captura de **SIGTERM** → vuelca estado a SQLite antes de salir; guardado al final de cada turno; reanudación.
- **Probar en local:** `docker stop` del game-service a media partida → al volver, se reanuda.
- **Criterios de aceptación:** estado inmutable ante desconexión; reanudación correcta.
- **Prompt para Claude:**
  > Añade manejo de `SIGTERM` en `game-service`: al recibirlo, vuelca el estado de las
  > partidas activas a SQLite y cierra limpio. Persiste también al final de cada turno e
  > implementa reanudación. Verifica con `docker stop`/`start` a media partida.

### ⬜ C4.3 — Auditoría de seguridad + tuning WAF
- **Objetivo:** endurecer todo el sistema.
- **Depende de:** C1.2, todas las rutas
- **Entregables:** HTTPS/WSS estricto, sanitización server-side revisada, WAF en modo `On`, secretos 100% en Vault, checklist de auditoría.
- **Probar en local:** batería de inputs maliciosos rechazados; ningún secreto en repo/imagen.
- **Criterios de aceptación:** checklist completo; WAF activo sin romper flujos legítimos.
- **Prompt para Claude:**
  > Realiza una pasada de hardening: fuerza HTTPS/WSS, revisa sanitización en cada ruta
  > Fastify, pon ModSecurity en `On`, confirma que no hay secretos fuera de Vault y genera
  > un `docs/SECURITY_CHECKLIST.md`. Verifica con payloads maliciosos de prueba.

### ⬜ C4.4 — Pruebas de carga
- **Objetivo:** validar rendimiento bajo concurrencia.
- **Depende de:** C4.1–C4.3
- **Entregables:** scripts de carga (k6/autocannon) para auth, WSS y proxy; informe de resultados.
- **Probar en local:** ejecutar carga y registrar latencias/errores.
- **Criterios de aceptación:** sin fugas ni caídas bajo carga objetivo; informe generado.
- **Prompt para Claude:**
  > Crea pruebas de carga con k6 (HTTP) y un cliente WSS concurrente para el `game-service`.
  > Mide latencia y errores en login, draft (caché) y sincronización de partidas. Genera
  > `docs/LOAD_TEST_REPORT.md` con los resultados.

---

# Extras implementados (fuera del orden de fases)

> Trabajo real ya en el código que adelanta o complementa componentes del plan.
> Se documenta aquí para no perder trazabilidad hasta reubicarlo en su fase.

### ✅ EX.1 — Sistema de ataques (moves) por Pokémon *(complementa C2.7 y C3.1)*
- **Objetivo:** cada Pokémon lleva **hasta 4 ataques reales** importados de PokeAPI,
  además de las acciones genéricas previas (`ATACAR`/`HABILIDAD`/`OBJETO`/`HUIR`).
- **Entregables (game-service):**
  - Tablas SQLite nuevas `moves` (catálogo deduplicado) y `pokemon_moves` (learnset)
    con índice `idx_pokemon_moves_pokemon` (`src/models/db.ts`).
  - `src/models/MoveModel.ts`: `findMove/saveMove/hasLearnset/listLearnset/saveLearnset`.
  - `PokemonService`: `getTemplate()` importa el learnset completo; `hydrateMove()`
    cachea detalles; `getCuratedMoves()` cura 4 ataques (prioriza level-up/MT,
    filtra `power>0`, ordena por STAB y potencia, garantiza ≥1 físico gratuito).
  - `MatchManager.withMoves()`: adjunta los 4 ataques a cada Pokémon al crear la
    partida (en paralelo, cacheado en SQLite → solo la 1ª partida paga red).
  - `engine/combat.computeMoveDamage()`: daño con ventaja del **tipo del movimiento**
    y STAB (1.2). `GameService.combatAction('MOVE', moveName)`: especiales cuestan
    1 candy del tipo del ataque; físicos gratis.
  - API: `POST /api/game/combat/action` acepta `{ action:'MOVE', moveName }`.
  - Frontend: la escena de combate muestra ≤4 botones de ataque + `OBJETO`/`HUIR`.
- **Doc detallada:** `docs/MOVES_SYSTEM.md`.
- **Pendiente:** mover el fetch/caché a `pokeapi-proxy` + Redis (C3.1); hidratar el
  learnset completo; recalcular ataques al evolucionar (C3.8).

### ✅ EX.2 — Purga de evoluciones del roster de draft
- Roster (`MatchManager.ROSTER_NAMES`) reducido de **32 a 27** Pokémon: fuera
  `charizard`, `blastoise`, `pidgeot`, `dragonite`, `jolteon`. El draft usa **solo
  formas base**; las evoluciones se obtendrán evolucionando en partida (C3.8).
- Efecto: `FLYING`=aerodactyl, `DRAGON`=dratini, `ELECTRIC`=pikachu quedan con un
  único Pokémon. Los equipos por defecto (3 por tipo) no cambian.

---

## Checklist global de requisitos ft_transcendence

- [ ] Fastify backend · [ ] TS + Tailwind frontend · [ ] SQLite por servicio
- [ ] Vault (sin secretos planos) · [ ] ModSecurity WAF · [ ] Nginx gateway + SSL
- [ ] RabbitMQ · [ ] Redis · [ ] WSS (sync + chat) · [ ] JWT + OAuth2 + 2FA
- [ ] Graceful shutdown (SIGTERM) · [ ] IA (1s refresh) · [ ] `docker-compose up --build`
