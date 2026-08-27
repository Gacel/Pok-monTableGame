#!/bin/sh
# Ajusta el destino del redirect HTTP->HTTPS al puerto PÚBLICO real.
#
# nginx redirige con `https://$host$request_uri`, y $host NO incluye el puerto.
# En producción da igual (443 es implícito), pero en local el gateway se publica
# en un puerto alto porque podman rootless no puede bindear <1024: el redirect
# mandaba a https://host/ (:443), donde no escucha nadie.
#
# Si PUBLIC_HTTPS_PORT es 443 o no está definido, no se toca nada.
set -e
PORT="${PUBLIC_HTTPS_PORT:-443}"
[ "$PORT" = "443" ] && exit 0
sed -i "s|return 301 https://\$host\$request_uri;|return 301 https://\$host:${PORT}\$request_uri;|" \
  /etc/nginx/nginx.conf
echo "[gateway] redirect HTTP->HTTPS apuntado al puerto publico :${PORT}"
