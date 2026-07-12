# SECURITY_CHECKLIST.md — Checklist de seguridad vivo

> Referenciado desde [`01-IMPLEMENTATION_PLAN.md`](01-IMPLEMENTATION_PLAN.md) y
> [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md) pero no existía como fichero — este
> documento lo sustituye. Se deriva de los hallazgos de
> [`archive/SECURITY_AUDIT.md`](archive/SECURITY_AUDIT.md) (2026-07-05) y de su
> resolución en [`08-AUTH.md`](08-AUTH.md). Mantenerlo actualizado en cada feature
> que toque auth, input de usuario, o superficie de red.

## Resuelto (verificado en código actual)

- [x] Login exige contraseña (scrypt) — ya no es posible suplantar una cuenta solo con el email (`AuthController.ts`).
- [x] IDs de usuario aleatorios (UUID), no derivados del email.
- [x] `JWT_SECRET` sin fallback hardcodeado; el arranque aborta si falta (`auth/jwt.ts`).
- [x] JWT con algoritmo fijado (HS256) + `aud`/`iss`.
- [x] JWT viaja en cookie `HttpOnly` + `Secure` + `SameSite`, no en `localStorage` ni en query string (WS o callback OAuth).
- [x] 2FA (TOTP) opcional disponible (`auth/totp.ts`, `POST /api/auth/2fa/setup`).
- [x] SQL parametrizado en todos los modelos (`models/*Model.ts`) — sin inyección.
- [x] Servidor autoritativo: movimientos, combate, compras, draft y loot se resuelven en `game-service`, nunca en el cliente.
- [x] XSS almacenado vía `avatarUrl` corregido (`escapeAttr` unificado + whitelist server-side).
- [x] CSP y cabeceras de seguridad activas en el gateway (`gateway/nginx.conf`): `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`.
- [x] DMs solo entre amigos (`ws.routes.ts`).

## Pendiente (requiere decisión/infra — no bloqueante para desarrollo local)

- [ ] **Rate limiting.** No hay `@fastify/rate-limit` ni límite de payload/throttle en WS. Ni HTTP ni WS están protegidos contra abuso/fuerza bruta hoy.
- [ ] **HashiCorp Vault.** Los secretos (`JWT_SECRET`, `GOOGLE_CLIENT_*`) se leen de variables de entorno planas (`process.env`), no de Vault, pese a ser obligatorio por [`CLAUDE.md §2`](../CLAUDE.md). `.env.example` solo tiene placeholders (`VAULT_ADDR`, `VAULT_DEV_ROOT_TOKEN`) sin uso real.
- [ ] **ModSecurity (WAF).** El gateway es Nginx plano con cabeceras de seguridad, pero sin módulo ModSecurity/OWASP CRS, pese a estar en el stack obligatorio.
- [ ] **Migraciones versionadas.** El esquema SQLite se crea inline y defensivamente en `models/db.ts`, no en `src/db/migrations` versionadas como pide [`CLAUDE.md §6`](../CLAUDE.md).
- [ ] **Recursos externos sin SRI.** La fuente `Press Start 2P` y otros recursos externos se cargan sin Subresource Integrity; considerar auto-hospedarlos.
- [ ] **PokeAPI/sprites sin proxy propio.** Se llama directamente a PokeAPI desde el cliente/servidor sin pasar por un `pokeapi-proxy` + Redis (ese servicio no existe todavía, ver [`03-ARCHITECTURE.md`](03-ARCHITECTURE.md)).

## Al añadir una feature nueva, revisar

- ¿Toca autenticación, sesión o datos de otro usuario? → confirmar que la autorización se comprueba en servidor (identidad → slot/dueño), nunca confiando en un id que mande el cliente.
- ¿Renderiza datos que vienen de otro usuario (nombre, avatar, mensajes)? → pasar por el escape/whitelist unificado (`utils/html`), no `innerHTML` directo.
- ¿Añade un endpoint HTTP o mensaje WS nuevo? → validar con esquema Fastify y no dejarlo fuera de la allowlist de rutas públicas documentada en [`07-API.md`](07-API.md).
- ¿Introduce un secreto nuevo? → variable de entorno documentada en `.env.example`, nunca commiteada; candidato a Vault cuando se integre.
