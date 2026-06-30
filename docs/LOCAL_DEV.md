# LOCAL_DEV.md — Desarrollo local con Docker

> Cómo levantar y probar cada componente **por separado** en local. Todo corre
> en Docker; el frontend, el backend y las BD se levantan como contenedores
> independientes detrás del gateway Nginx.

---

## 1. Requisitos previos

- Docker + Docker Compose v2
- Node 20 LTS (para `tsc`, lint y tests fuera de contenedor cuando convenga)
- `make` (opcional pero recomendado)
- Navegador para `https://localhost` (aceptar el certificado self-signed)

---

## 2. Primer arranque

```bash
cp .env.example .env                 # variables NO sensibles (las reales van a Vault)
bash gateway/gen-certs.sh            # certificados self-signed para localhost
make up                              # = docker-compose up --build
```

Comprobación rápida:

```bash
curl -k https://localhost/health     # -k acepta el cert self-signed
make ps                              # estado de los contenedores
```

---

## 3. Comandos de uso diario (Makefile)

| Comando | Qué hace |
|---------|----------|
| `make up` | `docker-compose up --build` (todo el stack) |
| `make down` | para y elimina contenedores y red |
| `make ps` | lista de servicios y estado |
| `make logs s=auth-service` | logs en vivo de un servicio |
| `make sh s=game-service` | shell dentro de un contenedor |
| `make rebuild s=frontend` | reconstruye solo un servicio |
| `make test s=game-service` | tests de un servicio |
| `make clean` | borra volúmenes (¡resetea las BD SQLite!) |

> Si no usas `make`, el equivalente directo es
> `docker compose up --build`, `docker compose logs -f <servicio>`, etc.

---

## 4. Levantar un solo componente (desarrollo aislado)

Mientras construyes componente a componente, no necesitas todo el stack.
Usa **perfiles** de compose o nombra el servicio y sus dependencias:

```bash
# Solo infraestructura de apoyo
docker compose up -d vault rabbitmq redis

# Solo auth y su gateway (con sus dependencias)
docker compose up --build auth-service gateway

# Solo el motor de juego y sus dependencias
docker compose up --build game-service rabbitmq

# Solo el frontend (apuntando a las APIs ya levantadas)
docker compose up --build frontend gateway
```

Recomendación: agrupa servicios con `profiles:` en `docker-compose.yml`
(p.ej. `infra`, `auth`, `game`, `front`) para levantar bloques con
`docker compose --profile game up`.

---

## 5. Orden recomendado al desarrollar

Sigue `docs/IMPLEMENTATION_PLAN.md`. En la práctica, ten siempre arriba:

1. `vault` (secretos) — necesario para casi todo.
2. `rabbitmq` + `redis` cuando entres en Fase 2/3.
3. El servicio en el que trabajas + `gateway`.
4. `frontend` cuando empieces la Fase 3.

Cada vez que cierres un componente, lanza `make up` completo para confirmar
que **todo el stack acumulado sigue levantando** (regla de "no romper lo anterior").

---

## 6. Verificación por servicio (smoke tests)

| Servicio | Comprobación local |
|----------|--------------------|
| gateway | `curl -k https://localhost/health` |
| vault | `docker compose exec vault vault status` |
| auth-service | `POST https://localhost/api/auth/register` → 201 |
| user-service | `GET https://localhost/api/users/me` con JWT → 200 |
| game-service | `POST https://localhost/api/game/matches` con JWT → 201 |
| pokeapi-proxy | `GET https://localhost/api/poke/pikachu` (2ª vez = cache hit) |
| status-service | `GET https://localhost/api/status/:id` |
| mail-service | publicar `mail.send` → ver correo en MailHog (`http://localhost:8025`) |
| rabbitmq | management UI en `http://localhost:15672` |
| WSS | cliente de prueba conecta a `wss://localhost/ws` con JWT |

---

## 7. Bases de datos SQLite

- Cada servicio tiene su propio fichero SQLite en un volumen nombrado.
- Inspección rápida: `make sh s=auth-service` y luego `sqlite3 /data/auth.db`.
- `make clean` borra los volúmenes → se pierden los datos (útil para empezar limpio).
- Las migraciones se aplican al arrancar el servicio (idempotentes).

---

## 8. Secretos en local (Vault dev)

- Vault corre en **modo dev** con un token raíz fijo definido en `.env`
  (solo para local; **nunca** en producción).
- `infra/vault/bootstrap.sh` carga los secretos placeholder al levantar.
- Para OAuth2 Google y SMTP reales, sustituye los placeholders en Vault, no en el repo.

---

## 9. Problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `NET::ERR_CERT_AUTHORITY_INVALID` | cert self-signed | acéptalo en el navegador o usa `curl -k` |
| 502 en una ruta `/api/...` | el servicio destino no está arriba | `make ps` y levanta ese servicio |
| Secreto vacío al arrancar | Vault sin bootstrap | re-ejecuta `infra/vault/bootstrap.sh` |
| WSS no conecta | falta JWT en handshake o ruta `/ws` mal proxied | revisa gateway y token |
| Cambios no aparecen | imagen cacheada | `make rebuild s=<servicio>` |

---

## 10. Antes de dar por cerrado el día

```bash
make up            # todo el stack levanta sin errores
make test s=...    # tests del componente tocado
git add -A && git commit -m "feat(<área>): <componente>"
```

> Recuerda la **Definición de Done** de `CLAUDE.md §7` para cada componente.
