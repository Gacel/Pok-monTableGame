# Pokémon Table Game — Transcendence 🎮🐉

![Project Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange)
![Arquitectura](https://img.shields.io/badge/Architecture-Microservices-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vite%20%7C%20TS%20%7C%20Tailwind-38B2AC)
![Backend](https://img.shields.io/badge/Backend-Fastify%20%7C%20Node.js-215732)

Un juego de mesa táctico multijugador por turnos sobre un tablero hexagonal, inspirado en mecánicas clásicas de estrategia y ambientado en el universo Pokémon. Creado como parte del proyecto **ft_transcendence**.

## 🌟 Características Principales

*   **Combate Táctico Hexagonal**: Movimientos basados en patrones (Volador, Tanque, Velocista), sistema de debilidades elementales, control de zonas y modificadores de terreno.
*   **Gestión de Recursos**: Dinámica tipo Catan donde controlar biomas genera recursos (Candies y Berries) necesarios para evolucionar.
*   **Tiempo Real**: Sincronización autoritativa y baja latencia a través de WebSockets (WSS).
*   **Seguridad y Autenticación**: JWT con OAuth2 (Google Sign-In), 2FA mediante TOTP, gestión estricta de secretos (HashiCorp Vault) y proxy inverso protegido mediante WAF (ModSecurity).
*   **Oponente IA**: Modo un jugador integrado con un oponente controlado por heurísticas que reacciona a los cambios en el tablero con visión limitada.
*   **Monorepo Microservicios**: Backend modular altamente escalable, orquestado con Docker y comunicados mediante eventos asíncronos (RabbitMQ).

## 🏗️ Arquitectura y Stack Tecnológico

El proyecto está diseñado usando una arquitectura de microservicios, contenida en un entorno Dockerizado de fácil despliegue local.

### Stack:
*   **Infraestructura**: Docker, Nginx (API Gateway + WAF ModSecurity), HashiCorp Vault.
*   **Backend**: Node.js + TypeScript con **Fastify**.
*   **Bases de Datos**: SQLite (para microservicios) y **Redis** (para caché agresiva de la PokeAPI).
*   **Colas de Mensajería**: **RabbitMQ** para comunicación asíncrona entre servicios.
*   **Frontend**: SPA desarrollada en **TypeScript + TailwindCSS + Vite** (sin frameworks UI como React/Vue).

## 🚀 Despliegue en Local (Desarrollo)

Para probar la plataforma en local, necesitarás tener instalado [Docker](https://www.docker.com/) y [Make](https://www.gnu.org/software/make/).

### 1. Preparar el entorno

Clona el repositorio e instala las dependencias del monorepo (solo necesario para herramientas de tooling y tipos locales, Docker levantará lo demás):

```bash
git clone git@github.com:Gacel/Pok-monTableGame.git
cd Pok-monTableGame
npm install
```

Configura tus variables de entorno copiando el ejemplo (modifica `.env` si es necesario):

```bash
cp .env.example .env
```

### 2. Iniciar Servicios

Levanta la infraestructura completa mediante Make:

```bash
make up
```

Esto compilará y ejecutará:
- **API Gateway (Nginx)** en `https://localhost` (usa certificados self-signed).
- **Vault** para gestión de secretos en local.
- **RabbitMQ** y **Redis**.
- Los microservicios (`auth`, `game`, `user`, etc.).
- El **Frontend** servido directamente en la raíz.

*Nota: La primera vez puede tardar unos minutos en descargar las imágenes base.*

### 3. Otros comandos útiles

*   `make logs`: Para ver los logs de los contenedores en tiempo real.
*   `make ps`: Para ver el estado de los contenedores de Docker.
*   `make down`: Para apagar el sistema limpiamente.

## 🗺️ Mapa de Ruta (Roadmap)

El desarrollo está organizado en las siguientes fases detalladas en [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md):

- [x] **FASE 0**: Cimientos del repo, Monorepo & Gateway.
- [ ] **FASE 1**: Seguridad & Auth (Vault, JWT, OAuth2, 2FA, RabbitMQ).
- [ ] **FASE 2**: Comunicación & Core de juego (Tablero Hexagonal, Movimientos, WSS).
- [ ] **FASE 3**: Datos & Frontend (PokeAPI Proxy, SPA, Interfaz de partida).
- [ ] **FASE 4**: IA & Hardening (Oponente automático, tests de carga, auditoría final).

## 📜 Licencia

Este proyecto está creado bajo los requerimientos de la escuela 42 (ft_transcendence).
