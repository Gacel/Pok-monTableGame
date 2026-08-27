#!/bin/sh
# Relaja la CSP para que funcione el dev server de Vite.
#
# nginx.conf lleva la politica de PRODUCCION (script-src 'self'), incompatible
# con el HMR de Vite: necesita 'unsafe-eval' para evaluar los modulos que
# recarga en caliente y 'unsafe-inline' para sus scripts inyectados.
#
# Solo actua si CSP_DEV=1, que unicamente define docker-compose.override.yml.
# En produccion esa variable no existe y este script no toca nada.
set -e
[ "${CSP_DEV:-0}" = "1" ] || exit 0

sed -i "s|script-src 'self';|script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;|" /etc/nginx/nginx.conf
sed -i "s|worker-src 'self';|worker-src 'self' blob:;|" /etc/nginx/nginx.conf
echo "[gateway] CSP RELAJADA para el dev server de Vite (unsafe-inline/unsafe-eval)."
echo "[gateway] Esto NO debe verse en produccion. Si aparece ahi, sobra CSP_DEV."
