FROM nginx:alpine

# Instalar openssl para generar el certificado en el arranque si no existe
RUN apk add --no-cache openssl

COPY gen-certs.sh /docker-entrypoint.d/99-gen-certs.sh
RUN chmod +x /docker-entrypoint.d/99-gen-certs.sh

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
