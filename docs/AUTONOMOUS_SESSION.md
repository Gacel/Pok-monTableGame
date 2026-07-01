# AUTONOMOUS_SESSION.md — Registro de trabajo autónomo

> Diario de la sesión de trabajo autónomo (sin intervención humana) solicitada el
> **2026-07-01**. Objetivo: revisar y mejorar el proyecto siguiendo la
> especificación técnica, aplicando **MVC**, **SQLite3**, y mejorando la
> **experiencia de usuario**. Cada feature = commit + push + documentación.

## Contexto y restricciones detectadas

- **Node/npm NO instalados en el host.** Toda verificación (typecheck/tests/build)
  se realiza vía **Docker** (`node:20-alpine`). Docker v29 disponible.
- **Rama de trabajo:** `feat/overnight-improvements` (para no tocar `main` sin
  supervisión; revisable por diff/PR a la mañana siguiente).
- **Acceso push:** OK (SSH a `github.com:Gacel/Pok-monTableGame`).
- `main` local iba 2 commits por delante de `origin` al empezar; la rama parte de ahí.

## Diagnóstico inicial

1. **Bug de routing Nginx:** `/api/auth` y `/api/users` apuntaban a `hello`, pero
   esas rutas viven en `game-service` → auth rota a través del gateway.
2. **Motor puro desconectado:** `move` usaba `board.moveOccupant` sin validar
   patrones, sin turnos, sin combate. `engine/movement.ts` y `resources.ts` existían
   pero no se usaban en el servidor.
3. **`server.ts` monolítico:** mezclaba auth + users + juego → sin separación MVC.
4. **Sin combate, sin modificadores ambientales, sin economía por turnos** conectados.
5. **Sin WebSockets** (el spec los exige para tiempo real).
6. **Tipado laxo** en frontend (`occupant: any`).
7. **Tests:** `mapLoader.test.ts` tenía 1 test rojo preexistente (mapeo de bioma).

## Metodología de verificación

- Typecheck: `docker run node:20-alpine … npx tsc --noEmit` sobre el repo montado.
- Tests: copia del servicio a fs Linux del contenedor + `vitest run` (evita un bug
  de `vitest` con nombres de fichero hasheados sobre el filesystem de Windows).

---

## Registro por feature

### F1 — Documentación base ✅
- **Qué:** `docs/ARCHITECTURE.md` (faltaba según `CLAUDE.md §4`), este diario, y
  aclaración del patrón MVC en ambas capas.
- **Por qué:** dar contexto y trazabilidad al trabajo autónomo.
- **Verificación:** N/A (documentación).
- **Commit:** `docs: add ARCHITECTURE.md and autonomous session journal`

<!-- Las siguientes entradas se añaden a medida que se completan. -->
