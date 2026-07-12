# Índice de documentación — ft_transcendence Pokémon Edition

> Punto de entrada a toda la documentación del proyecto. Si vas a crear un
> documento nuevo, sigue el convenio de abajo y añádelo a la tabla.

## Convenio de numeración

- Los documentos "vivos" (referencia técnica actual, se actualizan con el
  código) llevan prefijo numérico de 2 dígitos + nombre en
  `SCREAMING_SNAKE_CASE`: `NN-NOMBRE.md`.
- El número refleja el **orden de creación**, no la importancia ni un orden de
  lectura obligatorio. El siguiente documento nuevo usa el número más alto + 1
  (el último a día de hoy es `14`, así que el próximo sería `15-*.md`).
- Los documentos **históricos** (diarios de sesión, auditorías puntuales, planes
  de refactor ya ejecutados) van a `docs/archive/`, sin numerar — son un
  registro de un momento concreto, no una referencia a mantener al día. Cada uno
  lleva un banner `[HISTÓRICO]` al inicio apuntando al documento vivo que lo
  sustituye.
- `README.md` (este fichero) y los `README.md` de cada servicio
  (`services/*/README.md`) quedan sin numerar: son el punto de entrada de su
  carpeta, con la convención estándar de GitHub.

## Documentación viva

| # | Documento | Contenido |
|---|---|---|
| 01 | [`01-IMPLEMENTATION_PLAN.md`](01-IMPLEMENTATION_PLAN.md) | Roadmap maestro por fases/componentes (C0.1–C4.4), dependencias y criterios de aceptación de cada uno. |
| 02 | [`02-LOCAL_DEV.md`](02-LOCAL_DEV.md) | Cómo levantar y verificar el stack en local con Docker (`make up`, healthchecks, troubleshooting). |
| 03 | [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md) | Arquitectura objetivo vs. estado real: microservicios, MVC, esquema SQLite, comunicación, seguridad. |
| 04 | [`04-MOVES_SYSTEM.md`](04-MOVES_SYSTEM.md) | Sistema de ataques por Pokémon importados de PokeAPI (curación, learnsets, mapeo a AoE). |
| 05 | [`05-FRONTEND_MENU.md`](05-FRONTEND_MENU.md) | Árbol de navegación del hub del frontend (router imperativo, vistas, capas DOM). |
| 06 | [`06-PROGRESSION.md`](06-PROGRESSION.md) | Progresión del jugador: economía in-match, reparto de premios, inventario/starters/chat. |
| 07 | [`07-API.md`](07-API.md) | Referencia de endpoints HTTP/WS expuestos por `game-service` (auth, users, game, auctions...). |
| 08 | [`08-AUTH.md`](08-AUTH.md) | Auth real: password (scrypt), 2FA (TOTP), cookies HttpOnly, JWT endurecido. |
| 09 | [`09-AUCTIONS.md`](09-AUCTIONS.md) | Casa de subastas jugador-a-jugador: modos de venta, comisión, escrow, liquidación perezosa. |
| 10 | [`10-RESPONSIVE.md`](10-RESPONSIVE.md) | Refactor de diseño responsive del tablero (de canvas fijo + `scale()` a layout híbrido). |
| 11 | [`11-GAME_DESIGN_ROADMAP.md`](11-GAME_DESIGN_ROADMAP.md) | Documento maestro de diseño táctico: fases del motor de combate hexagonal, con estado ✅/🟧/⬜ y cita de archivo:línea. |
| 12 | [`12-TICKETS_TACTICS.md`](12-TICKETS_TACTICS.md) | Roadmap de jugabilidad por épicas y tickets (mecánicas tácticas + obtención + progresión + evolución + intercambio), listo para desarrollar, con dudas resueltas y dependencias. |
| 13 | [`13-SECURITY_CHECKLIST.md`](13-SECURITY_CHECKLIST.md) | Checklist de seguridad vivo: qué está resuelto, qué queda pendiente (rate limiting, Vault, ModSecurity...). |
| 14 | [`14-FRONTEND_ARCHITECTURE.md`](14-FRONTEND_ARCHITECTURE.md) | Arquitectura del cliente fuera del árbol de menús: controllers, capa `net/`, estado de sesión, IA local. |

## Archivo (histórico, no numerado)

| Documento | Por qué está archivado | Sustituido por |
|---|---|---|
| [`archive/AUTONOMOUS_SESSION.md`](archive/AUTONOMOUS_SESSION.md) | Diario de una sesión autónoma puntual (2026-07-01). | [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md), [`08-AUTH.md`](08-AUTH.md) |
| [`archive/ARCHITECTURE_AUDIT.md`](archive/ARCHITECTURE_AUDIT.md) | Auditoría MVC puntual (2026-07-05); hallazgos "Diferido" pueden seguir vigentes, revisar contra el código. | [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md) |
| [`archive/REFACTOR_PLAN.md`](archive/REFACTOR_PLAN.md) | Plan de la rama `refactor/security-mvc-audit`, ya fusionada. | [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md), [`08-AUTH.md`](08-AUTH.md) |
| [`archive/SECURITY_AUDIT.md`](archive/SECURITY_AUDIT.md) | Auditoría de seguridad puntual (2026-07-05); hallazgos críticos/altos ya resueltos. | [`08-AUTH.md`](08-AUTH.md), [`13-SECURITY_CHECKLIST.md`](13-SECURITY_CHECKLIST.md) |

## Estado real del proyecto (resumen a 2026-07-11)

Para no repetirlo en cada documento: hoy solo existen como código
**`game-service`** (backend Fastify+SQLite, incluye auth/users provisionalmente),
**`frontend`** (SPA Vite+TS+Tailwind) y el **gateway Nginx** (TLS + cabeceras de
seguridad, sin ModSecurity). `auth-service`, `user-service`, `status-service`,
`mail-service`, `pokeapi-proxy`, Vault, Redis, RabbitMQ e `infra/` están en el
diseño de [`CLAUDE.md`](../CLAUDE.md) pero **no tienen código todavía** — son
volúmenes/variables de entorno reservados, no servicios funcionando. El sistema
de evolución de Pokémon tampoco está implementado. Detalle completo en
[`03-ARCHITECTURE.md`](03-ARCHITECTURE.md) §3 y en
[`13-SECURITY_CHECKLIST.md`](13-SECURITY_CHECKLIST.md) para lo pendiente de seguridad.
