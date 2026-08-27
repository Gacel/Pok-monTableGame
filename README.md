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
*   **Seguridad y Autenticación**: JWT + login con contraseña y 2FA (TOTP) ya implementados; OAuth2 (Google Sign-In) con scaffold; gestión de secretos vía Vault y WAF ModSecurity siguen siendo objetivo de diseño, no implementados aún.
*   **Oponente IA**: Modo un jugador integrado con un oponente controlado por heurísticas que reacciona a los cambios en el tablero con visión limitada.
*   **Monorepo Microservicios**: pensado para ser modular y comunicarse mediante eventos asíncronos (RabbitMQ); hoy la lógica de auth/usuarios/partida vive toda en un único `game-service`, y RabbitMQ/Redis/Vault aún no tienen código — ver [`docs/README.md`](./docs/README.md) para el estado real detallado.

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

Esto compilará y ejecutará los servicios que existen hoy:
- **API Gateway (Nginx)** en `https://localhost` (usa certificados self-signed).
- **`game-service`**: backend Fastify + SQLite (juego, auth y usuarios — ver nota abajo).
- El **Frontend** servido directamente en la raíz.

*Vault, RabbitMQ y Redis todavía no tienen servicio en `docker-compose.yml` — están
reservados (volúmenes con nombre) pero sin implementar; `auth-service`, `user-service`,
`status-service`, `mail-service` y `pokeapi-proxy` tampoco existen como código propio
todavía, sus responsabilidades las cubre `game-service` de forma provisional.*

*Nota: La primera vez puede tardar unos minutos en descargar las imágenes base.*

### 3. Otros comandos útiles

*   `make logs`: Para ver los logs de los contenedores en tiempo real.
*   `make ps`: Para ver el estado de los contenedores de Docker.
*   `make down`: Para apagar el sistema limpiamente.

## 🗺️ Mapa de Ruta (Roadmap)

El desarrollo está organizado en las fases detalladas en [`docs/01-IMPLEMENTATION_PLAN.md`](./docs/01-IMPLEMENTATION_PLAN.md). El diseño táctico del motor de combate (con estado por fase y cita de archivo:línea) está en [`docs/11-GAME_DESIGN_ROADMAP.md`](./docs/11-GAME_DESIGN_ROADMAP.md). La arquitectura (objetivo vs. real) está en [`docs/03-ARCHITECTURE.md`](./docs/03-ARCHITECTURE.md); el índice completo de documentación en [`docs/README.md`](./docs/README.md).

- [x] **FASE 0**: Cimientos del repo, Monorepo & Gateway (SSL).
- [~] **FASE 1**: Seguridad & Auth — ✅ login con contraseña (scrypt), **2FA (TOTP)**, JWT endurecido en cookie HttpOnly; OAuth2 Google con scaffold. Vault y RabbitMQ siguen sin implementar; auth vive en `game-service`, no en un `auth-service` propio.
- [x] **FASE 2**: Core de juego — tablero hexagonal, patrones de movimiento, combate por turnos, modificadores de terreno, recursos (Catan), sigilo/emboscada en hierba alta, backend **MVC** autoritativo con persistencia SQLite, graceful shutdown y **WSS** (sync de tablero + chat).
- [~] **FASE 3**: Frontend — SPA (TS + Tailwind) con render del tablero, turnos, combate, recursos, minimapa, **draft de equipos**, **casa de subastas**, tienda/inventario, diseño **responsive**, y sync en vivo por WSS. `pokeapi-proxy` + Redis y `user-service` propios siguen pendientes (PokeAPI se llama directo desde el cliente/servidor).
- [~] **FASE 4**: IA & Hardening — ✅ oponente IA local por heurísticas (draft + combate), auditoría de seguridad/arquitectura ya realizada (ver [`docs/archive/`](./docs/archive/)) y resuelta en [`docs/08-AUTH.md`](./docs/08-AUTH.md). Pendiente: rate limiting, tests de carga, CI, y evolución de Pokémon (no implementada todavía) — ver [`docs/13-SECURITY_CHECKLIST.md`](./docs/13-SECURITY_CHECKLIST.md).

> **Arquitectura MVC** aplicada en backend (`models`/`controllers`/`routes`/`services` +
> `engine` puro) y frontend (`models`/`views`/`controllers`). El **servidor es la única
> fuente de verdad**: valida turno, propiedad y legalidad antes de mutar el estado.

## 📜 Licencia

Este proyecto está creado bajo los requerimientos de la escuela 42 (ft_transcendence).
