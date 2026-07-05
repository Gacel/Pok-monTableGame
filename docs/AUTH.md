# Autenticación

> Reescritura de seguridad (rama `refactor/security-mvc-audit`). Resuelve los
> hallazgos C1, C2, A1, M3, M4, B1 y frontend #2/#3 de `docs/audit/SECURITY_AUDIT.md`.

## Modelo

- **Registro real** con formulario: **Nombre, email, contraseña, confirmación,
  edad y "¿Estudiante42?"** (booleano). La confirmación de contraseña se valida
  en el cliente; el resto, en el servidor (esquemas Fastify).
- **Contraseñas** con hash **scrypt** (`node:crypto`, sin dependencias externas).
  Formato almacenado: `scrypt$<salt>$<hash>`.
- **IDs de usuario aleatorios** (`usr_<uuid>`), ya NO derivados del email.
- **Sesión en cookie `HttpOnly` + `SameSite=Lax` (+ `Secure`)**. El JWT ya no se
  guarda en `localStorage` ni viaja en la URL (ni en OAuth ni en el WebSocket).
- **JWT endurecido**: sin fallback de secreto (el arranque aborta si falta
  `JWT_SECRET`), algoritmo fijado `HS256`, `issuer`/`audience` validados.
- **2FA (TOTP)** opcional: endpoints `POST /api/auth/2fa/setup` y `/2fa/enable`;
  el login pide código si el usuario lo tiene activado.
- **DM solo entre amigos**: el WebSocket de chat directo exige amistad aceptada.

## Endpoints

| Método | Ruta | Cuerpo | Efecto |
|--------|------|--------|--------|
| POST | `/api/auth/signup` | name, email, password, age, student42 | Crea cuenta, set-cookie |
| POST | `/api/auth/login` | email, password, code? | Inicia sesión, set-cookie |
| POST | `/api/auth/logout` | — | Limpia la cookie |
| POST | `/api/auth/register` | username, avatarUrl | Completa perfil (autenticado) |
| POST | `/api/auth/2fa/setup` | — | Genera secreto TOTP |
| POST | `/api/auth/2fa/enable` | code | Verifica y activa 2FA |
| GET | `/api/auth/google/callback` | — | OAuth: set-cookie + redirect `/` |

## Login de pruebas (⚠️ puerta trasera)

Para testeo hay un acceso sin registro, **gateado por `ALLOW_TEST_LOGIN=true`**:

- Email: `admin@42transcendence.com` · Contraseña: `42transcendence`
- La cuenta (`Admin`, edad 42, Estudiante42) se crea al primer login y se reutiliza.
- Con `ALLOW_TEST_LOGIN` ausente o `false`, estas credenciales no tienen ningún
  trato especial (login normal → fallan si la cuenta no existe con esa contraseña).

**DESACTÍVALO en producción real** (`ALLOW_TEST_LOGIN=false` o quita la variable):
es una puerta trasera con credencial conocida, especialmente en un dominio público.

## Cambios de producto / migración

- **El login ahora exige contraseña.** Las cuentas antiguas creadas sin
  contraseña (modelo *passwordless*) no podrán iniciar sesión por email/contraseña
  hasta establecer una. Opciones: recrear la cuenta, o usar Google OAuth (mismo
  email → misma cuenta si ya existía). En un entorno con datos reales, añadir un
  flujo de "establecer contraseña" por email.
- **Cookie `Secure`.** En producción (tras el gateway HTTPS) debe ir a `true`
  (por defecto). Para desarrollo por http directo (`localhost:5173` sin gateway),
  poner `COOKIE_SECURE=false`.

## Pendiente (documentado, no implementado)
- Enrolado 2FA con QR (otpauth://) y UI de gestión en Ajustes.
- Rotación/refresh de tokens y lista de revocación.
- Carga de `JWT_SECRET` y credenciales de Google desde **HashiCorp Vault**.
- Rate limiting en login/registro (fuerza bruta).
