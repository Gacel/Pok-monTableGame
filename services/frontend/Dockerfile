# Se construye con contexto en la RAÍZ del monorepo (ver docker-compose.yml)
# para poder instalar @transcendence/shared vía npm workspaces.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/frontend/package.json ./services/frontend/
RUN npm install

COPY services/frontend ./services/frontend

WORKDIR /app/services/frontend

EXPOSE 5173
CMD ["npm", "run", "dev"]
