#!/usr/bin/env bash
# dev.sh — entrypoint de desarrollo local.
#
# Existe porque `make` no está instalado en todos los entornos de despliegue
# (y sin sudo no se puede instalar). El Makefile delega aquí, así que ambos
# caminos comparten la misma lógica. Ver docs/02-LOCAL_DEV.md.
set -euo pipefail
cd "$(dirname "$0")"

# --- 1. Comando de compose -------------------------------------------------
# Preferimos el plugin v2 (`docker compose`); si no existe, el binario v1
# (`docker-compose`). Con podman-docker el plugin v2 NO existe: `podman compose`
# no es un subcomando válido, así que la detección debe probarlo de verdad.
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  elif command -v podman-compose >/dev/null 2>&1; then
    echo "podman-compose"
  else
    echo "ERROR: no encuentro docker compose, docker-compose ni podman-compose." >&2
    exit 1
  fi
}

# --- 2. Socket del motor ---------------------------------------------------
# Con podman ROOTLESS, /var/run/docker.sock apunta al socket de root y no es
# accesible por un usuario normal. El socket bueno es el de la sesión de
# usuario. Solo lo fijamos si DOCKER_HOST no viene ya del entorno.
setup_docker_host() {
  [ -n "${DOCKER_HOST:-}" ] && return 0
  command -v podman >/dev/null 2>&1 || return 0

  local sock="/run/user/$(id -u)/podman/podman.sock"
  if [ ! -S "$sock" ]; then
    systemctl --user start podman.socket >/dev/null 2>&1 || true
  fi
  if [ -S "$sock" ]; then
    export DOCKER_HOST="unix://$sock"
  fi
}

# --- 2b. Red CNI (solo podman) ---------------------------------------------
# podman 3.4 escribe los .conflist con cniVersion 1.0.0, pero el plugin
# `firewall` de containernetworking-plugins en Ubuntu 22.04 solo entiende hasta
# 0.4.0. La red queda INVÁLIDA y podman la reporta como "not found": `up` falla
# con «error configuring network namespace ... CNI network not found». Creamos
# la red antes que compose y bajamos la versión del conflist si procede.
ensure_network() {
  command -v podman >/dev/null 2>&1 || return 0
  local net="transcendence-net"
  if ! podman network ls --format '{{.Name}}' 2>/dev/null | grep -qx "$net"; then
    podman network create "$net" >/dev/null 2>&1 || true
  fi
  local conf="${XDG_CONFIG_HOME:-$HOME/.config}/cni/net.d/${net}.conflist"
  if [ -f "$conf" ] && grep -q '"cniVersion": *"1\.0\.0"' "$conf"; then
    sed -i 's/"cniVersion": *"1\.0\.0"/"cniVersion": "0.4.0"/' "$conf"
    echo "AVISO: cniVersion de '$net' bajada a 0.4.0 (plugin firewall antiguo)." >&2
  fi
}

# --- 3. Requisitos previos -------------------------------------------------
preflight() {
  if [ ! -f .env ]; then
    echo "ERROR: falta .env (game-service lo exige vía env_file y compose aborta)." >&2
    echo "       Cópialo desde .env.example y ajústalo:  cp .env.example .env" >&2
    exit 1
  fi
  # Un .env guardado en Windows deja CR al final de cada valor; compose los
  # mete literalmente en las variables y rompe puertos y URLs.
  if grep -q $'\r' .env; then
    echo "AVISO: .env tiene saltos de línea CRLF (Windows). Normalizando a LF." >&2
    sed -i 's/\r$//' .env
  fi
  ensure_network
  # El override bind-montea este directorio; si no existe, el motor lo crearía
  # con permisos raros o fallaría.
  mkdir -p services/game-service/data
}

# --- 4. Emisión del certificado Let's Encrypt ------------------------------
# Usa el reto HTTP-01 por webroot: certbot escribe en el volumen certbot_webroot
# y nginx lo sirve en /.well-known/acme-challenge/ desde el puerto 80. Requisitos:
#   - los dominios deben resolver a la IP pública de ESTE host
#   - el gateway debe estar publicado en el puerto 80 REAL (no 8080), porque
#     Let's Encrypt siempre valida contra el 80
#
# --cert-name fija el nombre del directorio en /etc/letsencrypt/live/, que es la
# ruta que nginx.conf tiene cableada. Así podemos emitir para poke.* sin tocar
# la configuración de nginx.
issue_cert() {
  local extra="${1:-}"
  set -a; . ./.env 2>/dev/null || true; set +a

  local email="${CERT_EMAIL:-}"
  local name="${CERT_NAME:-42transcendence.com}"
  local domains="${CERT_DOMAINS:-poke.42transcendence.com}"

  if [ -z "$email" ]; then
    echo "ERROR: define CERT_EMAIL en .env (Let's Encrypt lo exige para avisos de caducidad)." >&2
    exit 1
  fi

  local http_port="${HOST_GATEWAY_HTTP:-8080}"
  if [ "$http_port" != "80" ]; then
    echo "ERROR: el gateway está publicado en el puerto $http_port, no en el 80." >&2
    echo "       Let's Encrypt valida SIEMPRE contra el 80. Pon HOST_GATEWAY_HTTP=80" >&2
    echo "       en .env y recrea el gateway. Requiere permitir puertos <1024" >&2
    echo "       en rootless (ver docs/02-LOCAL_DEV.md §12)." >&2
    exit 1
  fi

  local args=""
  for d in $domains; do args="$args -d $d"; done

  echo "Emitiendo certificado:"
  echo "  cert-name : $name"
  echo "  dominios  :$args"
  echo "  email     : $email"
  [ -n "$extra" ] && echo "  modo      : $extra"
  echo

  # shellcheck disable=SC2086
  $COMPOSE run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    --cert-name "$name" \
    $args \
    --email "$email" \
    --agree-tos --no-eff-email --non-interactive \
    --keep-until-expiring \
    $extra

  if [ -z "$extra" ]; then
    echo
    echo "Recargando nginx para que tome el certificado nuevo..."
    $COMPOSE exec gateway nginx -s reload
  fi
}

COMPOSE=$(detect_compose)

# --- 5. Modo produccion ----------------------------------------------------
# Compose auto-carga docker-compose.override.yml, que es de DESARROLLO. Para
# produccion hay que nombrar los ficheros explicitamente, lo que ademas evita
# que el override se cuele. Se activa con:  PROD=1 ./dev.sh up-d
if [ -n "${PROD:-}" ]; then
  COMPOSE="$COMPOSE -f docker-compose.yml -f docker-compose.prod.yml"
  echo "[modo PRODUCCION] frontend estatico, sin bind mounts, sin HMR" >&2
fi

setup_docker_host

usage() {
  cat <<'EOF'
Uso: ./dev.sh <comando> [servicio]

  up                 Levanta todo el stack en primer plano (con build)
  up-d               Igual pero en segundo plano
  down               Para y elimina contenedores y red
  ps                 Estado de los servicios
  logs [svc]         Logs en vivo (todos, o de un servicio)
  sh <svc>           Shell dentro de un contenedor
  rebuild <svc>      Reconstruye y reinicia un servicio
  test <svc>         Ejecuta los tests de un servicio
  clean              Para todo y BORRA volúmenes (resetea las BD)
  urls               Muestra en qué puertos queda expuesto el stack
  doctor             Diagnostica el entorno sin levantar nada
  cert-dry-run       Ensaya la emisión del certificado (NO consume cuota)
  cert               Emite/renueva el certificado Let's Encrypt de verdad

Modo produccion: prefija cualquier comando con PROD=1
  PROD=1 ./dev.sh up-d      frontend estatico (nginx), sin HMR ni bind mounts
  PROD=1 ./dev.sh ps
EOF
}

cmd="${1:-help}"
svc="${2:-}"

case "$cmd" in
  up)      preflight; $COMPOSE up --build ;;
  up-d)    preflight; $COMPOSE up --build -d ;;
  down)    $COMPOSE down ;;
  ps)      $COMPOSE ps ;;
  logs)    $COMPOSE logs -f ${svc:+"$svc"} ;;
  sh)      [ -n "$svc" ] || { echo "Indica el servicio: ./dev.sh sh game-service" >&2; exit 1; }
           $COMPOSE exec "$svc" sh ;;
  rebuild) [ -n "$svc" ] || { echo "Indica el servicio: ./dev.sh rebuild frontend" >&2; exit 1; }
           preflight; $COMPOSE up --build -d "$svc" ;;
  test)    [ -n "$svc" ] || { echo "Indica el servicio: ./dev.sh test game-service" >&2; exit 1; }
           preflight; $COMPOSE run --rm "$svc" npm test ;;
  clean)   $COMPOSE down -v ;;
  cert-dry-run) preflight; issue_cert "--dry-run" ;;
  cert)         preflight; issue_cert ;;
  urls)
    # shellcheck disable=SC1091
    set -a; . ./.env 2>/dev/null || true; set +a
    hp="${HOST_GATEWAY_HTTP:-8080}"; sp="${HOST_GATEWAY_HTTPS:-8443}"
    [ "$sp" = "443" ] && sfx="" || sfx=":$sp"
    echo "Gateway  HTTPS : https://localhost${sfx}"
    echo "Gateway  HTTP  : http://localhost:${hp}   (redirige a HTTPS)"
    echo "hello          : http://localhost:${HOST_HELLO:-13000}/health"
    echo "game-service   : http://localhost:${HOST_GAME:-13001}"
    echo "frontend (vite): http://localhost:${HOST_FRONTEND:-15173}"
    ;;
  doctor)
    echo "compose      : $COMPOSE"
    echo "DOCKER_HOST  : ${DOCKER_HOST:-(por defecto del cliente)}"
    echo -n ".env         : "; [ -f .env ] && echo "presente" || echo "FALTA"
    echo -n "motor        : "; docker version --format '{{.Server.Version}}' 2>/dev/null || echo "NO responde"
    echo -n "puerto mínimo sin privilegio: "; cat /proc/sys/net/ipv4/ip_unprivileged_port_start 2>/dev/null || echo "?"
    echo -n "swap         : "; free -m | awk '/Swap/{print $2" MB"}'
    echo -n "RAM libre    : "; free -m | awk '/Mem/{print $7" MB disponibles"}'
    echo "--- validación de la config de compose ---"
    preflight
    $COMPOSE config >/dev/null && echo "compose config OK"
    ;;
  help|-h|--help) usage ;;
  *) echo "Comando desconocido: $cmd" >&2; usage; exit 1 ;;
esac
