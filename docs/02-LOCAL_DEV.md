# LOCAL_DEV.md — Desarrollo local con Docker

> Cómo levantar y probar cada componente **por separado** en local. Todo corre
> en Docker; el frontend, el backend y las BD se levantan como contenedores
> independientes detrás del gateway Nginx.

---

## 1. Requisitos previos

- **Motor de contenedores**: Docker + Compose v2, **o** podman + `docker-compose`
  v1 (el servidor de despliegue usa podman rootless; ver §12).
- Node 20+ (para `tsc`, lint y tests fuera de contenedor cuando convenga).
- `make` **opcional**: si no está instalado, usa `./dev.sh` con los mismos
  comandos (`./dev.sh up` en vez de `make up`). El `Makefile` solo delega en él.
- Navegador para aceptar el certificado self-signed.

---

## 2. Primer arranque

```bash
cp .env.example .env     # variables NO sensibles (las reales van a Vault)
./dev.sh up-d            # construye y levanta todo en segundo plano
./dev.sh urls            # muestra en qué puertos ha quedado expuesto
```

No hay que generar certificados a mano: `gateway/gen-certs.sh` es un *entrypoint*
que corre **dentro** del contenedor del gateway y crea un self-signed en el
volumen `letsencrypt` si no hay ninguno. Ejecutarlo en el host fallaría, porque
escribe en `/etc/letsencrypt`.

Comprobación rápida:

```bash
./dev.sh ps                                  # los 4 servicios en (healthy)
curl -k https://localhost:8443/health        # -k acepta el cert self-signed
```

> **Puertos.** Los de host se parametrizan con variables `HOST_*` y sus valores
> por defecto **no** son los canónicos, por dos motivos: podman rootless no puede
> bindear puertos <1024, y en el servidor de despliegue 3000/3001 ya están
> ocupados por otros servicios (un panel web y el proyecto iptv). Defaults:
> gateway `8080`/`8443`, hello `13000`, game-service `13001`, frontend `15173`.
> Los puertos *internos* de los contenedores siguen siendo 3000/3001/5173: solo
> cambia la cara publicada al host. Para usar 80/443 hace falta root (ver §12).

---

## 3. Comandos de uso diario

Todos existen en las dos formas; `make` delega en `dev.sh`.

| `dev.sh` | `make` | Qué hace |
|----------|--------|----------|
| `./dev.sh up` | `make up` | levanta todo el stack (con build), en primer plano |
| `./dev.sh up-d` | `make up-d` | igual, en segundo plano |
| `./dev.sh down` | `make down` | para y elimina contenedores y red |
| `./dev.sh ps` | `make ps` | lista de servicios y estado (incluye healthcheck) |
| `./dev.sh logs game-service` | `make logs s=game-service` | logs en vivo de un servicio |
| `./dev.sh sh game-service` | `make sh s=game-service` | shell dentro de un contenedor |
| `./dev.sh rebuild frontend` | `make rebuild s=frontend` | reconstruye solo un servicio |
| `./dev.sh test game-service` | `make test s=game-service` | tests de un servicio |
| `./dev.sh clean` | `make clean` | borra volúmenes (¡resetea las BD SQLite!) |
| `./dev.sh urls` | `make urls` | puertos en los que está expuesto el stack |
| `./dev.sh doctor` | `make doctor` | diagnostica el entorno sin levantar nada |
| `./dev.sh cert-dry-run` | — | ensaya la emisión del certificado (no consume cuota) |
| `./dev.sh cert` | — | emite/renueva el certificado Let's Encrypt (ver §13) |

`dev.sh` resuelve por su cuenta cuatro cosas que de otro modo hay que recordar:
detecta el comando de compose disponible, apunta `DOCKER_HOST` al socket rootless
de podman cuando toca, deja la red CNI en un estado válido, y valida que exista
`.env` antes de invocar a compose.

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

> Ya hay un profile en uso: `certbot`. Queda **fuera** del arranque por defecto
> porque en local no hay un dominio público resolviendo a este host y entraría en
> un bucle de renovaciones fallidas. Para producción: `docker-compose --profile
> certbot up -d`.

---

## 5. Orden recomendado al desarrollar

Sigue [`01-IMPLEMENTATION_PLAN.md`](01-IMPLEMENTATION_PLAN.md). En la práctica, ten siempre arriba:

1. `vault` (secretos) — necesario para casi todo. **Nota:** `vault` no existe
   todavía en `docker-compose.yml` (ver [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md)); esta
   sección describe el flujo objetivo, no el actual.
2. `rabbitmq` + `redis` cuando entres en Fase 2/3 (tampoco implementados hoy).
3. El servicio en el que trabajas + `gateway`.
4. `frontend` cuando empieces la Fase 3.

Cada vez que cierres un componente, lanza `./dev.sh up-d` completo para confirmar
que **todo el stack acumulado sigue levantando** (regla de "no romper lo anterior").

---

## 6. Verificación por servicio (smoke tests)

| Servicio | Comprobación local |
|----------|--------------------|
| gateway | `curl -k https://localhost:8443/health` |
| vault | `docker compose exec vault vault status` |
| auth-service | `POST https://localhost:8443/api/auth/register` → 201 |
| user-service | `GET https://localhost:8443/api/users/me` con JWT → 200 |
| game-service | `POST https://localhost:8443/api/game/matches` con JWT → 201 |
| pokeapi-proxy | `GET https://localhost:8443/api/poke/pikachu` (2ª vez = cache hit) |
| status-service | `GET https://localhost:8443/api/status/:id` |
| mail-service | publicar `mail.send` → ver correo en MailHog (`http://localhost:8025`) |
| rabbitmq | management UI en `http://localhost:15672` |
| WSS | cliente de prueba conecta a `wss://localhost:8443/ws` con JWT |

> Un `401` en `/api/game` **no** es un fallo del stack: es el endpoint pidiendo
> autenticación, que es la respuesta correcta sin JWT.

---

## 7. Bases de datos SQLite

- Cada servicio tiene su propio fichero SQLite en un volumen nombrado.
- Inspección rápida: `./dev.sh sh game-service` y luego `sqlite3 data/game.db`.
- `./dev.sh clean` borra los volúmenes → se pierden los datos (útil para empezar
  limpio). Ojo: también borra el volumen `letsencrypt`, así que el gateway
  regenerará un certificado self-signed nuevo en el siguiente arranque.
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
| 502 en una ruta `/api/...` | el servicio destino no está arriba | `./dev.sh ps` y levanta ese servicio |
| Secreto vacío al arrancar | Vault sin bootstrap | re-ejecuta `infra/vault/bootstrap.sh` |
| WSS no conecta | falta JWT en handshake o ruta `/ws` mal proxied | revisa gateway y token |
| Cambios no aparecen | imagen cacheada | `./dev.sh rebuild <servicio>` |
| `Couldn't find env file: .../.env` | falta `.env`; `game-service` lo exige vía `env_file` y compose **aborta antes de arrancar nada** | `cp .env.example .env` |
| `short-name "nginx:alpine" did not resolve` | podman sin registros de búsqueda para nombres cortos de imagen | crear `~/.config/containers/registries.conf` con `unqualified-search-registries = ["docker.io"]` |
| `CNI network "transcendence-net" not found`, pese a que `podman network ls` la lista | podman 3.4 escribe el `.conflist` con `cniVersion 1.0.0`, y el plugin `firewall` de Ubuntu 22.04 solo soporta hasta `0.4.0`: la red no valida y se ignora | lo corrige `dev.sh` solo (`ensure_network`) |
| `bind: permission denied` al publicar el gateway | podman rootless no puede bindear puertos <1024 | usar los defaults `8080`/`8443`, o ver §12 |
| `address already in use` en 3000/3001 | otros servicios del host ocupan esos puertos | ajustar `HOST_HELLO` / `HOST_GAME` en `.env` |
| Contenedor `Up` pero nunca `(healthy)` | bajo podman el `HEALTHCHECK` de la imagen se ignora (formato OCI) | declarar el healthcheck en `docker-compose.yml`, no en el Dockerfile |
| Valores de `.env` con basura invisible | fichero guardado en Windows con CRLF: el `\r` acaba dentro del valor, y `COOKIE_SECURE=false\r` deja de ser igual a `false` | `dev.sh` lo normaliza en cada arranque |
| El redirect de `:8080` lleva a un puerto muerto | `$host` en nginx no incluye el puerto | ya resuelto: el entrypoint `98-public-port.sh` lo reescribe con `PUBLIC_HTTPS_PORT` |
| 404 entrando por IP en vez de por hostname | nginx enruta por `server_name`; el bloque de `zi.irishawk.com` es el primero en `:443` y hace de *default server* | usar un hostname que case, o dar `default_server` al bloque del proyecto |
| `vite`/`tsx: not found` (code 127) al arrancar un servicio | capa de `npm install` cacheada/corrupta que omitió devDependencies | reconstruir sin caché: `docker compose build --no-cache <servicio>` y luego `up -d` |
| 502 en `/api/...` tras recrear un backend | Nginx cacheó la IP vieja del upstream (el contenedor cambió de IP) | `docker restart transcendence-gateway` para re-resolver. Ojo: el gateway no arranca si algún upstream (`frontend`, `game-service`) está caído |

---

## 10. Antes de dar por cerrado el día

```bash
./dev.sh up-d        # todo el stack levanta sin errores
./dev.sh ps          # los 4 servicios en (healthy)
./dev.sh test <svc>  # tests del componente tocado
git add -A && git commit -m "feat(<área>): <componente>"
```

> Recuerda la **Definición de Done** de `CLAUDE.md §7` para cada componente.

---

## 11. Verificar sin Node instalado en el host (solo Docker)

Si la máquina **no tiene Node/npm**, puedes hacer typecheck y tests usando
contenedores efímeros. Instala primero las dependencias del workspace una vez
(se persisten en `node_modules/` vía bind-mount):

```bash
docker run --rm -v "$PWD:/app" -w /app node:20-alpine npm install
```

**Typecheck de un servicio** (rápido, sobre el bind-mount):

```bash
docker run --rm -v "$PWD:/app" -w /app/services/game-service \
  node:20-alpine npx tsc --noEmit
```

**Tests** — el filesystem de Windows puede romper ficheros con nombres hasheados
de `vitest`/`tsx`. Copiando el servicio a un fs Linux dentro del contenedor se evita:

```bash
docker run --rm -v "$PWD:/src:ro" node:20-alpine sh -c '
  mkdir -p /build/services && cp /src/tsconfig.base.json /build/tsconfig.base.json &&
  cp -r /src/services/game-service /build/services/ &&
  cd /build/services/game-service && rm -rf node_modules &&
  npm install --silent && npx vitest run'
```

> En PowerShell, sustituye `$PWD` por la ruta absoluta (p.ej. `F:\Transcendence`)
> y `localhost` por `127.0.0.1` al hacer smoke tests dentro del contenedor
> (el server escucha en IPv4).

---

## 12. Servidor de despliegue: podman rootless

El VPS de despliegue no tiene Docker: tiene **podman 3.4.4** con el shim
`podman-docker` (el binario `docker` es una emulación) y **`docker-compose` v1.29.2**.
No existe el plugin `docker compose` v2 — `podman compose` no es un subcomando
válido. Tampoco hay `make`, y sin `sudo` no se puede instalar.

Consecuencias, ya resueltas en el repo:

- El entrypoint real es **`./dev.sh`**, no `make`.
- `dev.sh` fija `DOCKER_HOST` al socket **rootless**
  (`/run/user/$UID/podman/podman.sock`). Importante: `/var/run/docker.sock`
  apunta al socket de **root** y un usuario normal no puede usarlo, de ahí que
  compose falle con un error de conexión si no se define `DOCKER_HOST`.
- Los puertos de host van a valores altos (ver §2).

Dos ajustes viven **fuera del repo**, en la configuración del usuario, y hay que
replicarlos en cualquier host podman nuevo:

```bash
# 1. Resolución de nombres cortos de imagen (nginx:alpine, certbot/certbot…)
mkdir -p ~/.config/containers
echo 'unqualified-search-registries = ["docker.io"]' > ~/.config/containers/registries.conf

# 2. El socket de podman debe estar activo; para que sobreviva al logout:
systemctl --user enable --now podman.socket
loginctl enable-linger "$USER"
```

### Servir en 80/443

Requiere privilegios, y por eso no está hecho. Dos vías, ambas con root:

```bash
# Opción A — permitir puertos bajos a procesos sin privilegios (persistente)
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-podman-ports.conf
sudo sysctl --system

# Opción B — publicar en los puertos altos y redirigir con el firewall (nftables/iptables)
```

Después, fija en `.env`: `HOST_GATEWAY_HTTP=80` y `HOST_GATEWAY_HTTPS=443`.
El entrypoint del gateway detecta que el puerto es el 443 y deja el redirect
HTTP→HTTPS sin sufijo de puerto, como corresponde en producción.

### Memoria

El VPS tiene **1.9 GB de RAM y cero swap**. El stack completo consume ~700 MB, así
que cabe, pero sin margen: construir varias imágenes en paralelo puede provocar un
OOM kill. `docker-compose` v1 construye en serie, que es justo lo que interesa
aquí. Si añades servicios pesados (Vault, RabbitMQ, Redis y los cinco
microservicios que faltan), habilita swap antes.

---

## 13. Certificados TLS: self-signed en local, Let's Encrypt en producción

Hay **dos** mecanismos y conviene no confundirlos:

| | Local | Producción |
|---|---|---|
| Origen | `gateway/gen-certs.sh` (entrypoint del gateway) | Let's Encrypt vía certbot |
| Cuándo actúa | al arrancar, si no hay certificado | `./dev.sh cert` (emisión) + servicio `certbot` (renovación) |
| Confianza | ninguna: hay que usar `curl -k` o aceptarlo en el navegador | cadena válida, sin avisos |

Ambos escriben en la **misma ruta**, `/etc/letsencrypt/live/$CERT_NAME/`, que es la
que `gateway/nginx.conf` tiene cableada. Por eso el self-signed desaparece en
cuanto hay uno real: `gen-certs.sh` no genera nada si ya existe un certificado.

### Emisión inicial

Requisitos, todos verificables antes de intentarlo:

1. Los dominios de `CERT_DOMAINS` deben resolver a la IP pública de este host.
2. El gateway debe estar publicado en el **puerto 80 real**: Let's Encrypt valida
   siempre contra el 80, nunca contra 8080. En rootless eso exige haber bajado
   `ip_unprivileged_port_start` (ver §12).
3. `CERT_EMAIL` definido en `.env` (Let's Encrypt lo exige).

```bash
./dev.sh cert-dry-run    # ensayo contra el entorno de staging: NO consume cuota
./dev.sh cert            # emisión real + reload de nginx
```

**Haz siempre el ensayo primero.** Let's Encrypt limita a 5 fallos por hora y por
dominio; el `--dry-run` no cuenta para ese límite y detecta los problemas
habituales (DNS mal apuntado, puerto 80 cerrado en el cortafuegos del proveedor,
redirect que se come la ruta del reto).

`CERT_DOMAINS` lleva **comillas** en `.env` a propósito: sin ellas, al hacer
`source` del fichero solo se asignaría el primer dominio y el certificado saldría
con un único SAN.

`--cert-name` (variable `CERT_NAME`) fija el nombre del directorio bajo
`live/`, que puede ser distinto del primer dominio. Eso permite emitir para
`poke.42transcendence.com` manteniendo la ruta `live/42transcendence.com/` que
espera nginx, sin tocar su configuración.

> Si ya hay un self-signed en esa ruta, apártalo antes de la primera emisión
> (`mv .../live/$CERT_NAME .../live/$CERT_NAME.selfsigned.bak`). Si no, certbot
> crea una *lineage* paralela `$CERT_NAME-0001` y nginx seguiría leyendo la
> antigua.

### Renovación

Son **dos** piezas, y faltando cualquiera el certificado caduca a los 90 días:

```bash
docker-compose --profile certbot up -d certbot
```

- El servicio `certbot` ejecuta `certbot renew` cada 12 h. Solo renueva si quedan
  menos de 30 días, así que es seguro dejarlo corriendo.
- El **gateway recarga nginx cada 6 h** (bucle en su `command`). Esto es
  imprescindible: certbot escribe los ficheros nuevos, pero nginx sigue sirviendo
  el certificado que tiene cargado en memoria hasta recibir un `SIGHUP`. Sin esa
  recarga, la renovación sería invisible hasta el siguiente reinicio.

Comprobar el certificado que se sirve de verdad:

```bash
echo | openssl s_client -connect <dominio>:443 -servername <dominio> 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

El `issuer` debe ser Let's Encrypt. Si sale el mismo valor que el `subject`, lo
que se sirve es el self-signed.
