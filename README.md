*This project has been created as part of the 42 curriculum by jesumore, crmunoz-, sbenitez, jvalle-d.*

# Pokemon Transcendence

A tactical multiplayer board game on a hexagonal grid, blending Pokemon combat with Catan-style resource management, chess-like movement patterns, and real-time online play — built as a full-stack web application with a microservice-oriented architecture.

![Status](https://img.shields.io/badge/Status-In%20Development-orange)
![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vite%20%7C%20TS%20%7C%20Tailwind-38B2AC)
![Backend](https://img.shields.io/badge/Backend-Fastify%20%7C%20Node.js-215732)

---

## Table of Contents

1. [Description](#description)
2. [Team Information](#team-information)
3. [Project Management](#project-management)
4. [Technical Stack](#technical-stack)
5. [Database Schema](#database-schema)
6. [Features List](#features-list)
7. [Modules](#modules)
8. [Individual Contributions](#individual-contributions)
9. [Instructions](#instructions)
10. [Resources](#resources)
11. [Privacy Policy & Terms of Service](#privacy-policy--terms-of-service)
12. [License](#license)

---

## Description

**Pokemon Transcendence** is a turn-based tactical strategy game played on a hexagonal board, where players draft Pokemon teams, deploy them onto terrain-rich maps, and battle for control of biomes that generate resources (Candies and Berries). Controlling territory lets you evolve your Pokemon, purchase items from the shop, and trade with other players through an auction house.

### Key Features

- **Hexagonal Tactical Combat**: Movement patterns (Flyer, Tank, Speedster), elemental type advantages, terrain modifiers (tall grass stealth, ice sliding, fire/water damage), area-of-effect attacks.
- **Resource Economy**: Catan-inspired biome control generates resources needed for evolution, items, and progression.
- **Multiple Game Modes**: Single-player vs AI (3 difficulty levels), local multiplayer (2-4 players, FFA or 2v2), online multiplayer with lobby/matchmaking, Arena (persistent world), Survival (real stakes — capture or lose Pokemon), and Battle Royale.
- **Real-Time Sync**: Authoritative server with WebSocket-based state synchronization for live online matches and in-game chat.
- **Pokemon Collection**: Gacha system (Pokeballs), starter selection, trading between players, auction house, evolution with stones and rare candies, shiny variants.
- **AI Opponent**: Heuristic-based bot with configurable difficulty that handles both drafting and tactical combat with limited board vision.
- **Authentication & Security**: Password authentication (scrypt hashing), 2FA (TOTP), Google OAuth 2.0, JWT in HttpOnly cookies, HTTPS everywhere.
- **8-bit Retro Aesthetic**: Pixel-art sprites, Press Start 2P typography, chiptune audio, canvas-based board rendering with minimap.

---

## Team Information

<!-- TODO: Adjust roles to match your actual team distribution -->

| Member | Role(s) | Responsibilities |
|--------|---------|------------------|
| **jvalle-d** | Tech Lead / Developer | Technical architecture, game engine, backend systems, WebSocket infrastructure, deployment |
| **sbenitez** | Project Manager / Developer | Team coordination, progress tracking, frontend views, UI/UX implementation |
| **crmunoz-** | Product Owner / Developer | Feature prioritization, product vision validation, game logic, combat system |
| **jesumore** | Developer | Frontend features, community systems, shop/auction/trading, testing |

> With a team of 4, members hold multiple roles as recommended by the subject.

---

## Project Management

### Organization

- **Methodology**: Iterative development following a phased implementation plan ([`docs/01-IMPLEMENTATION_PLAN.md`](./docs/01-IMPLEMENTATION_PLAN.md)), with each phase producing a deployable increment.
- **Task Tracking**: GitHub Issues and an internal ticket system documented in [`docs/12-TICKETS_TACTICS.md`](./docs/12-TICKETS_TACTICS.md) (84 detailed tickets) and [`docs/13b-TICKETS_UX_POLISH.md`](./docs/13b-TICKETS_UX_POLISH.md) (UX polish tickets).
- **Communication**: Discord for daily async communication, weekly sync meetings to review progress and plan next steps.
- **Code Reviews**: Pull requests reviewed by at least one other team member before merging.
- **Documentation**: 34+ design documents in [`docs/`](./docs/) covering architecture, game design, security, API contracts, and more (see [`docs/README.md`](./docs/README.md) for the full index).

### Development Phases

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 0** | Done | Monorepo setup, Docker pipeline, Nginx gateway with TLS |
| **Phase 1** | Done | Authentication (password + 2FA + Google OAuth), JWT, security hardening |
| **Phase 2** | Done | Game engine (hex board, movement, combat, terrain, resources, stealth, AoE), MVC backend, SQLite persistence, WebSocket sync |
| **Phase 3** | Done | Full SPA frontend (all menus, canvas board, HUD, minimap, draft, shop, auction house, inventory, community, responsive design) |
| **Phase 4** | In Progress | AI opponent, security audit, testing, polish |

---

## Technical Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Backend** | **Fastify** (Node.js) | High-performance HTTP framework with built-in schema validation, WebSocket support via `@fastify/websocket`, and structured logging (Pino). Chosen per project constraints. |
| **Frontend** | **TypeScript + Tailwind CSS + Vite** | Pure TypeScript SPA with no UI framework (no React/Vue/Angular). Tailwind for utility-first responsive styling. Vite for fast HMR during development. Canvas API for board rendering. |
| **Database** | **SQLite** | Lightweight, zero-config, file-based. Each service gets its own database. WAL mode for concurrent reads. |
| **Real-time** | **WebSockets (WSS)** | Low-latency bidirectional communication for board state sync and in-game chat. Server is the single source of truth. |
| **Auth** | **scrypt + JWT + TOTP** | Password hashing with scrypt (timing-safe comparison), JWTs in HttpOnly/Secure/SameSite cookies, TOTP-based 2FA via RFC 6238. Google OAuth 2.0 via `@fastify/oauth2`. |
| **Gateway** | **Nginx** | Reverse proxy with TLS termination (Let's Encrypt), security headers (CSP, HSTS, X-Frame-Options), WebSocket upgrade support. |
| **Containerization** | **Docker + docker-compose** | Single-command deployment (`docker-compose up --build`). Isolated services, named volumes for persistence. |
| **Shared Types** | **`@transcendence/shared`** | npm workspace package with domain types, DTOs, and utility functions shared between frontend, backend, and tests. |
| **Testing** | **Vitest** | 28 test files covering game engine mechanics (hex geometry, combat, movement, evolution, capture, trading, progression, stealth, terrain). |

---

## Database Schema

All tables reside in the game-service SQLite database (`data/game.db`, WAL mode, foreign keys enabled).

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│   users       │     │   owned_pokemon    │     │   pokemons    │
├──────────────┤     ├───────────────────┤     ├──────────────┤
│ id (PK)       │◄────│ user_id (FK)       │     │ name (PK)     │
│ email          │     │ id (PK)            │────►│ hp             │
│ username       │     │ name (FK)          │     │ atk            │
│ password_hash  │     │ level              │     │ def            │
│ avatar_url     │     │ xp                 │     │ type           │
│ level          │     │ is_shiny           │     │ speed          │
│ coins          │     │ is_starter         │     │ size           │
│ age            │     │ lost_at            │     └──────────────┘
│ totp_secret    │     │ auction_id         │
│ two_factor_on  │     │ trade_id           │     ┌──────────────┐
│ is_student42   │     │ acquired_via       │     │   moves        │
└──────────────┘     └───────────────────┘     ├──────────────┤
       │                                         │ name (PK)     │
       │              ┌───────────────────┐     │ type           │
       │              │   matches          │     │ power          │
       ├─────────────►├───────────────────┤     │ accuracy       │
       │  host_id     │ id (PK)            │     │ pp             │
       │              │ status             │     │ damage_class   │
       │              │ turn               │     │ display_name   │
       │              │ mode               │     └──────────────┘
       │              │ game_mode          │            │
       │              │ capacity           │     ┌──────────────┐
       │              │ host_id (FK)       │     │pokemon_moves  │
       │              │ players_json       │     ├──────────────┤
       │              └───────────────────┘     │ pokemon (FK)   │
       │              ┌───────────────────┐     │ move (FK)      │
       │              │   match_state      │     └──────────────┘
       │              ├───────────────────┤
       │              │ match_id (FK, PK)  │     ┌──────────────┐
       │              │ state_json         │     │  evolutions    │
       │              └───────────────────┘     ├──────────────┤
       │                                         │ name (FK)     │
       │              ┌───────────────────┐     │ evolves_to     │
       ├─────────────►│  friendships       │     │ trigger        │
       │              ├───────────────────┤     │ min_level      │
       │              │ user_id (FK)       │     │ item           │
       │              │ friend_id (FK)     │     └──────────────┘
       │              └───────────────────┘
       │              ┌───────────────────┐     ┌──────────────┐
       ├─────────────►│ friend_requests    │     │  owned_items   │
       │              ├───────────────────┤     ├──────────────┤
       │              │ from_id (FK)       │     │ user_id (FK)   │
       │              │ to_id (FK)         │     │ kind           │
       │              │ created_at         │     │ item_key       │
       │              └───────────────────┘     │ qty            │
       │                                         └──────────────┘
       │              ┌───────────────────┐
       ├─────────────►│   auctions         │     ┌──────────────┐
       │              ├───────────────────┤     │   messages     │
       │              │ id (PK)            │     ├──────────────┤
       │              │ seller_id (FK)     │     │ id (PK)       │
       │              │ pokemon_id (FK)    │     │ from_id (FK)  │
       │              │ start_price        │     │ to_id (FK)    │
       │              │ current_bid        │     │ body          │
       │              │ bidder_id          │     │ created_at    │
       │              └───────────────────┘     └──────────────┘
       │
       │              ┌───────────────────┐
       └─────────────►│    trades          │
                      ├───────────────────┤
                      │ id (PK)            │
                      │ from_id (FK)       │
                      │ to_id (FK)         │
                      │ offer_pokemon (FK) │
                      │ want_pokemon (FK)  │
                      │ status             │
                      └───────────────────┘
```

**14 tables** total. Relations enforce referential integrity via foreign keys. User-facing data (Pokemon ownership, trades, auctions) uses transactional writes to prevent race conditions.

---

## Features List

### Core Gameplay
| Feature | Description | Contributors |
|---------|-------------|-------------|
| Hexagonal Board Engine | Procedural hex map generation with 8 biome types, terrain modifiers, fog of war | jvalle-d, crmunoz- |
| Movement System | Type-based movement patterns (Flyer, Tank, Speedster), dash, knockback, body-block, airborne mechanics | jvalle-d, crmunoz- |
| Combat System | Turn-based battles with type advantages, AoE attacks (single/radius/line/cone), stealth/ambush in tall grass | jvalle-d, crmunoz- |
| Resource Economy | Biome control generates Candies/Berries, used for evolution and purchases | jvalle-d |
| Evolution System | Level-up evolution, stone evolution, trade evolution, rare candy usage | jvalle-d, crmunoz- |
| Capture System | Wild Pokemon capture during Survival mode with Pokeball mechanics | jvalle-d |
| AI Opponent | Heuristic bot with 3 difficulty levels, handles draft + combat with limited vision | jvalle-d |

### Multiplayer & Social
| Feature | Description | Contributors |
|---------|-------------|-------------|
| Online Multiplayer | Lobby system (create/join rooms), WebSocket sync, reconnection on refresh | jvalle-d, sbenitez |
| Multiple Game Modes | FFA, 2v2 Teams, Battle Royale, Arena, Survival | jvalle-d, crmunoz- |
| Friends System | Send/accept/reject requests, recommended friends, online status | sbenitez, jesumore |
| In-game Chat | Real-time WebSocket chat during matches | jvalle-d, sbenitez |
| Trading | Player-to-player Pokemon trades with escrow | jesumore, jvalle-d |
| Gifting | Send Pokemon to friends | jesumore |

### Economy & Collection
| Feature | Description | Contributors |
|---------|-------------|-------------|
| Starter Selection | Choose 3 starter Pokemon at account creation | sbenitez, jesumore |
| Shop | Buy Pokeballs, evolution stones, rare candies | jesumore, sbenitez |
| Gacha System | Open Pokeballs with weighted rarity (normal/super/ultra/master) | jesumore |
| Auction House | List, bid, buy-now, cancel auctions for Pokemon | jesumore, sbenitez |
| Inventory | View and manage owned Pokemon and items | jesumore, sbenitez |
| Progression | XP, leveling, coin rewards per match | jvalle-d, crmunoz- |

### Authentication & Security
| Feature | Description | Contributors |
|---------|-------------|-------------|
| Email + Password Auth | Signup/login with scrypt-hashed passwords | jvalle-d, sbenitez |
| Two-Factor Auth (2FA) | TOTP setup/enable/verify flow | jvalle-d |
| Google OAuth 2.0 | Sign in with Google via @fastify/oauth2 | jvalle-d |
| JWT Cookies | HttpOnly, Secure, SameSite=Strict tokens | jvalle-d |
| HTTPS / WSS | TLS everywhere via Nginx with Let's Encrypt | jvalle-d |

### Frontend & UX
| Feature | Description | Contributors |
|---------|-------------|-------------|
| Canvas Board Renderer | Hardware-accelerated hex board with zoom, pan, terrain textures | jvalle-d, crmunoz- |
| Responsive Design | Mobile-first layout, touch support | sbenitez, crmunoz- |
| Minimap | Real-time overview of the full board | jvalle-d |
| HUD Overlay | Turn info, resources, team status, action buttons | sbenitez, crmunoz- |
| Visual Effects | Evolution animations, combat FX, gacha opening animation | sbenitez, jesumore |
| Audio System | Background music, combat sounds, UI feedback | sbenitez |
| 8-bit Aesthetic | Pixel sprites (PokeAPI/Showdown), retro typography, chiptune audio | sbenitez, jesumore |

---

## Modules

We target **17 points** (3 above the 14-point minimum) for safety margin.

### Module Breakdown

| # | Module | Category | Type | Pts | Status |
|---|--------|----------|------|-----|--------|
| 1 | **Backend framework (Fastify)** | Web | Minor | 1 | Done |
| 2 | **Real-time features (WebSockets)** | Web | Major | 2 | Done |
| 3 | **User interaction (chat, profiles, friends)** | Web | Major | 2 | Done |
| 4 | **Web-based game** | Gaming | Major | 2 | Done |
| 5 | **Remote players** | Gaming | Major | 2 | Done |
| 6 | **Standard user management** | User Management | Major | 2 | Done |
| 7 | **OAuth 2.0 (Google)** | User Management | Minor | 1 | Done |
| 8 | **Two-Factor Authentication (2FA)** | User Management | Minor | 1 | Done |
| 9 | **AI Opponent** | Artificial Intelligence | Major | 2 | Done |
| 10 | **Game customization** | Gaming | Minor | 1 | Done |
| 11 | **Gamification system** | Gaming | Minor | 1 | Done |
| | | | **Total** | **17** | |

### Module Justifications

1. **Backend framework (Fastify)** — Fastify v4 with schema validation, structured logging (Pino), and plugin ecosystem (`@fastify/websocket`, `@fastify/oauth2`, `@fastify/cookie`).

2. **Real-time features (WebSockets)** — Full WSS implementation for board state synchronization, chat messaging, and lobby updates. Handles connection/disconnection gracefully with session recovery on page refresh.

3. **User interaction** — Chat system (real-time messages during matches), user profiles (username, avatar, level, stats), friends system (add/remove/recommend, request management).

4. **Web-based game** — Complete tactical hex board game with clear rules, win/loss conditions, turn-based multiplayer, 2D canvas rendering. Supports 2-4 players.

5. **Remote players** — Two (or more) players on separate computers play in real-time via WebSocket synchronization. Handles latency, disconnection, and reconnection (F5 rejoin via session persistence).

6. **Standard user management** — Profile editing, avatar selection (8 trainer sprites), friends list with online status, user search, level/coins display.

7. **OAuth 2.0** — Google Sign-In via `@fastify/oauth2`, creates/links accounts automatically on first login.

8. **2FA** — TOTP-based two-factor authentication (RFC 6238). Users can set up via QR code, enable with verification code, and are prompted on each login.

9. **AI Opponent** — Heuristic-based AI that handles both the draft phase (team selection) and tactical combat. Three difficulty levels (Easy/Medium/Hard) with configurable aggression, vision range, and decision-making depth. The AI evaluates board state, type advantages, terrain, and resource value to make decisions.

10. **Game customization** — 6 game modes (Single Player, Local Multiplayer, Online, Arena, Survival, Battle Royale), 8 terrain types with unique modifiers, FFA vs Teams configurations, adjustable player count (2-4).

11. **Gamification system** — XP/level progression system (gain XP from matches, level up for rewards), coin economy, shop with purchasable items, gacha Pokeball system with 4 rarity tiers, achievements through Pokemon collection and evolution milestones.

---

## Individual Contributions

<!-- TODO: Adjust contributions to reflect each member's actual work -->

### jvalle-d — Tech Lead / Developer
- Designed and implemented the monorepo architecture, Docker pipeline, and Nginx gateway
- Built the core game engine: hex geometry, board generation, movement system, combat mechanics, AoE calculations, terrain effects, stealth/ambush, evolution, capture
- Implemented the authentication system (password hashing, JWT, 2FA, Google OAuth)
- Built WebSocket infrastructure for real-time game sync and chat
- Developed the AI opponent (draft strategy + tactical combat heuristics)
- Set up the shared types package (`@transcendence/shared`)
- Wrote the majority of backend tests (26 test files)

### sbenitez — Project Manager / Developer
- Coordinated team meetings, tracked progress, and managed the development timeline
- Built frontend views: login, main menu, play menu, lobby, community, settings
- Implemented responsive design across all views
- Developed the HUD overlay and audio system
- Contributed to online multiplayer frontend (lobby UI, room management)
- Worked on the visual effects and 8-bit aesthetic

### crmunoz- — Product Owner / Developer
- Defined product vision, prioritized features, and validated completed work
- Contributed to the game engine: combat formulas, movement patterns, terrain modifiers
- Built the canvas-based board renderer with zoom and pan
- Worked on multiple game modes (Teams, FFA, Arena rules)
- Contributed to responsive design and HUD components

### jesumore — Developer
- Built the economy systems: shop, auction house, trading, gacha
- Implemented inventory management and item usage
- Developed the starter selection flow
- Built the gifting and friend interaction features
- Contributed to frontend visual effects (gacha animation, evolution FX)
- Worked on the 8-bit sprite and audio integration

---

## Instructions

### Prerequisites

- [Docker](https://www.docker.com/) (v20.10+) and Docker Compose
- [Make](https://www.gnu.org/software/make/) (optional, for shortcut commands)
- [Node.js](https://nodejs.org/) v20 LTS (only for local tooling; Docker handles runtime)
- A modern browser (latest Google Chrome recommended)

### 1. Clone and configure

```bash
git clone git@github.com:Gacel/Pok-monTableGame.git
cd Pok-monTableGame
cp .env.example .env
```

Edit `.env` if you need to change any default values. The `.env.example` file documents all available variables.

### 2. Install dependencies (optional, for local tooling only)

```bash
npm install
```

This is only needed for IDE support (TypeScript types, linting). Docker builds install their own dependencies.

### 3. Start the application

```bash
make up
# or directly:
docker-compose up --build
```

This builds and launches all services:

| Service | Internal Port | Access |
|---------|--------------|--------|
| **Nginx Gateway** | 80, 443 | `https://localhost` (self-signed cert on first run) |
| **game-service** (Fastify) | 3001 | Via gateway at `/api/*` and `/ws` |
| **frontend** (Vite) | 5173 | Via gateway at `/` |

> The first build may take a few minutes to download base images.

### 4. Access the application

Open **https://localhost** in Google Chrome. Accept the self-signed certificate warning (or add an exception).

### 5. Useful commands

| Command | Description |
|---------|-------------|
| `make up` | Build and start all services |
| `make down` | Stop all services cleanly |
| `make logs` | Stream logs from all containers |
| `make ps` | Show container status |

### 6. Development mode

The `docker-compose.override.yml` enables hot-reload with bind mounts and exposes individual service ports (3000, 3001, 5173) for direct access during development.

---

## Resources

### References

- [Fastify Documentation](https://fastify.dev/docs/latest/) — Backend framework
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) — Styling
- [Vite Documentation](https://vitejs.dev/) — Frontend build tool
- [SQLite Documentation](https://sqlite.org/docs.html) — Database
- [PokeAPI](https://pokeapi.co/) — Pokemon data source (sprites, moves, evolutions)
- [Pokemon Showdown Sprites](https://play.pokemonshowdown.com/sprites/) — Pixel art sprites
- [Red Blob Games — Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) — Hex geometry reference
- [RFC 6238 (TOTP)](https://datatracker.ietf.org/doc/html/rfc6238) — 2FA implementation reference

### AI Usage

AI tools (primarily Claude / Claude Code) were used during development for:

- **Code assistance**: Generating boilerplate, suggesting implementations for complex algorithms (hex geometry, AoE calculations, pathfinding).
- **Debugging**: Identifying issues in WebSocket synchronization, SQLite schema migrations, and authentication flows.
- **Documentation**: Drafting and refining design documents, API contracts, and this README.
- **Testing**: Generating test cases for engine mechanics (combat, movement, evolution, capture).
- **Refactoring**: Improving code structure, identifying potential bugs, and suggesting optimizations.

All AI-generated code was reviewed, tested, and validated by team members before integration. Team members can explain and justify every piece of code in the project.

---

## Privacy Policy & Terms of Service

Accessible from the application at multiple points (welcome screen, login page, and main menu):

- **Privacy Policy** — Data collection, usage, storage, security measures, third-party services, and user rights (GDPR).
- **Terms of Service** — Account rules, user conduct, in-game economy, intellectual property, fair play, and liability.

---

## License

This project was created under the requirements of Ecole 42 (ft_transcendence).

Transcendence Project, 42Malaga Fundacion Telefonica.

© 2026 jesumore, crmunoz-, sbenitez & jvalle-d
