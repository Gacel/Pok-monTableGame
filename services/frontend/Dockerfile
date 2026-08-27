# Se construye con contexto en la RAÍZ del monorepo (ver docker-compose.yml)
# para poder instalar @transcendence/shared vía npm workspaces.
#
# Multi-stage con DOS destinos:
#   target: dev        -> dev server de Vite con HMR (lo usa docker-compose.override.yml)
#   target: production -> dist/ estático servido por nginx (lo usa docker-compose.prod.yml)
#
# `production` va ÚLTIMO a propósito: es el destino por defecto si nadie
# especifica `target`. El modo desarrollo es el que hay que pedir explícitamente.

# ---------------------------------------------------------------------------
# Dependencias del workspace (capa compartida por dev y build)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/frontend/package.json ./services/frontend/
RUN npm install

# ---------------------------------------------------------------------------
# Desarrollo: transpila al vuelo y recarga en caliente
# ---------------------------------------------------------------------------
FROM deps AS dev

COPY services/frontend ./services/frontend
WORKDIR /app/services/frontend

EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Build de producción: genera dist/ (tsc + vite build)
# ---------------------------------------------------------------------------
FROM deps AS build

COPY services/frontend ./services/frontend
WORKDIR /app/services/frontend
RUN npm run build

# ---------------------------------------------------------------------------
# Producción: solo nginx y los ficheros estáticos.
#
# Ni Node, ni npm, ni el código fuente, ni las 300+ dependencias de desarrollo
# viajan a esta imagen: únicamente el contenido de dist/. Eso reduce el tamaño
# y la superficie de ataque.
#
# Escucha en 5173 (no en el 80 habitual de nginx) para que el upstream
# `frontend:5173` del gateway siga siendo válido sin tocar su configuración.
# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=build /app/services/frontend/dist /usr/share/nginx/html
COPY services/frontend/nginx.prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173
