# Servicio temporal hello — valida el pipeline Docker (C0.2)
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (mejor cache de capas)
COPY package.json ./
RUN npm install

# Código fuente
COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000

# Healthcheck a nivel de imagen (wget viene en alpine)
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "run", "start"]
