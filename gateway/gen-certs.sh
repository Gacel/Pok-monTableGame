#!/bin/sh
set -e

# Fallback de arranque: si el volumen de Let's Encrypt está vacío (p. ej. un
# despliegue desde cero, antes de la primera emisión), generamos un certificado
# self-signed temporal en la MISMA ruta que usa nginx para que el gateway pueda
# arrancar y servir el challenge ACME en :80. En cuanto certbot emite/renueva el
# certificado real, sustituye a este. Si ya existe un certificado, no se toca.
DOMAIN=42transcendence.com
LIVE=/etc/letsencrypt/live/$DOMAIN

if [ ! -f "$LIVE/fullchain.pem" ]; then
  echo "[gateway] Sin certificado en $LIVE; genero self-signed temporal para arrancar."
  mkdir -p "$LIVE"
  # IMPORTANTE: los navegadores modernos (Edge/Chrome) ignoran el CN y exigen
  # Subject Alternative Name (SAN). Sin SAN el certificado se rechaza como
  # "credenciales incorrectas". Incluimos todos los host servidos por nginx.
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$LIVE/privkey.pem" \
    -out "$LIVE/fullchain.pem" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN,DNS:poke.$DOMAIN,DNS:www.poke.$DOMAIN,DNS:localhost,IP:127.0.0.1"
  echo "[gateway] Certificado temporal (con SAN) generado."
else
  echo "[gateway] Certificado presente en $LIVE; no se genera nada."
fi
