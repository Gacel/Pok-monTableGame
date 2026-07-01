# Se construye con contexto en la RAÍZ del monorepo (ver docker-compose.yml)
# para poder instalar @transcendence/shared vía npm workspaces.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/game-service/package.json ./services/game-service/
RUN npm install

COPY services/game-service/tsconfig.json ./services/game-service/
COPY services/game-service/src ./services/game-service/src

WORKDIR /app/services/game-service

EXPOSE 3001
CMD ["npm", "run", "dev"]
