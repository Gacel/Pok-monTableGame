#!/bin/sh
set -e

# Asegurar que el directorio existe
mkdir -p /etc/nginx/ssl

if [ ! -f /etc/nginx/ssl/localhost.crt ]; then
  echo "Generando certificados self-signed para localhost..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/localhost.key \
    -out /etc/nginx/ssl/localhost.crt \
    -subj "/C=ES/ST=Madrid/L=Madrid/O=42/OU=Transcendence/CN=localhost"
  echo "Certificados generados."
else
  echo "Los certificados ya existen."
fi
