import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';
import { signToken } from '../auth/jwt.js';
import { setSessionCookie, clearSessionCookie } from '../auth/cookie.js';
import { hashPassword, verifyPassword, newUserId } from '../auth/password.js';
import { generateTotpSecret, verifyTotp } from '../auth/totp.js';

interface SignupBody {
  name?: string;
  email?: string;
  password?: string;
  age?: number;
  student42?: boolean;
}
interface LoginBody {
  email?: string;
  password?: string;
  code?: string; // TOTP, si el usuario tiene 2FA activado
}
interface RegisterBody {
  username?: string;
  avatarUrl?: string;
}
interface TwoFactorBody {
  code?: string;
}

function normalizeEmail(raw: unknown): string {
  return (typeof raw === 'string' ? raw : '').trim().toLowerCase();
}
function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
const USERNAME_RE = /^[\w\sáéíóúñÁÉÍÓÚÑ-]+$/u;
/** avatarUrl es un id de sprite de entrenador (ej. 'red'); charset seguro anti-XSS. */
const AVATAR_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Login de PRUEBAS (sin registro). ⚠️ PUERTA TRASERA: solo activo si
 * `ALLOW_TEST_LOGIN=true`. Debe estar DESACTIVADO en producción real.
 */
const TEST_EMAIL = 'admin@42transcendence.com';
const TEST_PASSWORD = '42transcendence';
const testLoginEnabled = (): boolean => process.env.ALLOW_TEST_LOGIN === 'true';

function userId(request: FastifyRequest): string | undefined {
  return (request as FastifyRequest & { userId?: string }).userId;
}

/**
 * Capa CONTROLADOR de autenticación.
 *
 * Registro real con **contraseña** (hash scrypt), IDs de usuario aleatorios
 * (UUID, no derivados del email) y sesión en **cookie HttpOnly**. Soporta 2FA
 * (TOTP) opcional. Ver docs/08-AUTH.md.
 */
export const AuthController = {
  /** Registro: Nombre, email, contraseña, edad y Estudiante42. */
  async signup(request: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply) {
    const name = (request.body?.name ?? '').trim();
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password ?? '';
    const age = request.body?.age;
    const student42 = request.body?.student42 === true;

    if (!name || name.length > 16 || !USERNAME_RE.test(name)) {
      return reply.code(400).send({ success: false, error: 'Nombre inválido (máx. 16 caracteres)' });
    }
    if (!isValidEmail(email)) {
      return reply.code(400).send({ success: false, error: 'Email inválido' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return reply.code(400).send({ success: false, error: 'La contraseña debe tener entre 8 y 128 caracteres' });
    }
    if (!Number.isInteger(age) || (age as number) < 1 || (age as number) > 120) {
      return reply.code(400).send({ success: false, error: 'Edad inválida' });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return reply
        .code(409)
        .send({ success: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' });
    }

    const user = await UserModel.createAccount({
      id: newUserId(),
      email,
      passwordHash: hashPassword(password),
      username: name,
      age: age as number,
      isStudent42: student42,
    });

    setSessionCookie(reply, signToken(user.id));
    return { success: true, user: UserModel.toSafe(user) };
  },

  /** Login: email + contraseña (+ código TOTP si el usuario tiene 2FA). */
  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password ?? '';
    const code = request.body?.code;

    // Login de PRUEBAS sin registro (solo con ALLOW_TEST_LOGIN=true). La cuenta
    // se crea la primera vez y luego se reutiliza.
    if (testLoginEnabled() && email === TEST_EMAIL && password === TEST_PASSWORD) {
      const existing = await UserModel.findByEmail(TEST_EMAIL);
      const admin =
        existing ??
        (await UserModel.createAccount({
          id: newUserId(),
          email: TEST_EMAIL,
          passwordHash: hashPassword(TEST_PASSWORD),
          username: 'Admin',
          age: 42,
          isStudent42: true,
        }));
      setSessionCookie(reply, signToken(admin.id));
      return { success: true, user: UserModel.toSafe(admin) };
    }

    const user = await UserModel.findByEmail(email);
    // Error genérico e indistinguible (anti-enumeración): no revelar si el email existe.
    const GENERIC = 'Correo o contraseña incorrectos';
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ success: false, error: GENERIC });
    }

    if (user.two_factor_enabled) {
      if (!code) {
        return reply.code(401).send({ success: false, twoFactorRequired: true, error: 'Introduce tu código 2FA' });
      }
      if (!user.totp_secret || !verifyTotp(user.totp_secret, code, Date.now())) {
        return reply.code(401).send({ success: false, twoFactorRequired: true, error: 'Código 2FA incorrecto' });
      }
    }

    setSessionCookie(reply, signToken(user.id));
    return { success: true, user: UserModel.toSafe(user) };
  },

  /** Cierra la sesión limpiando la cookie. */
  async logout(_request: FastifyRequest, reply: FastifyReply) {
    clearSessionCookie(reply);
    return { success: true };
  },

  /** Completa el perfil (nombre + avatar) del usuario AUTENTICADO. */
  async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const id = userId(request);
    if (!id) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const username = (request.body?.username ?? '').trim();
    const avatarUrl = (request.body?.avatarUrl ?? '').trim();

    if (!username || !avatarUrl) {
      return reply.code(400).send({ success: false, error: 'Faltan datos' });
    }
    if (username.length > 16 || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ success: false, error: 'Nombre de usuario inválido' });
    }
    if (!AVATAR_RE.test(avatarUrl)) {
      return reply.code(400).send({ success: false, error: 'Avatar inválido' });
    }
    const user = await UserModel.setProfile(id, username, avatarUrl);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    return { success: true, user: UserModel.toSafe(user) };
  },

  /** 2FA paso 1: genera y guarda un secreto TOTP; lo devuelve para enrolar. */
  async twoFactorSetup(request: FastifyRequest, reply: FastifyReply) {
    const id = userId(request);
    if (!id) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const secret = generateTotpSecret();
    await UserModel.setTotpSecret(id, secret);
    return { success: true, secret };
  },

  /** 2FA paso 2: verifica un código con el secreto guardado y activa 2FA. */
  async twoFactorEnable(request: FastifyRequest<{ Body: TwoFactorBody }>, reply: FastifyReply) {
    const id = userId(request);
    if (!id) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const user = await UserModel.findById(id);
    const code = request.body?.code ?? '';
    if (!user?.totp_secret || !verifyTotp(user.totp_secret, code, Date.now())) {
      return reply.code(400).send({ success: false, error: 'Código incorrecto' });
    }
    await UserModel.setTwoFactor(id, true);
    return { success: true };
  },

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-ignore - el plugin decora la instancia; los tipos no siempre lo captan
      const { token } = await request.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const userInfo = (await userInfoResponse.json()) as { email?: string };

      const email = normalizeEmail(userInfo.email);
      if (!isValidEmail(email)) {
        return reply.code(400).send({ success: false, error: 'No se pudo obtener el email de Google' });
      }

      const existing = await UserModel.findByEmail(email);
      const user = existing ?? (await UserModel.createOAuthUser(newUserId(), email));

      // La sesión viaja en cookie HttpOnly (no en la URL). Redirige limpio al frontend.
      setSessionCookie(reply, signToken(user.id));
      return reply.redirect('/');
    } catch (err) {
      request.server.log.error(err);
      return reply.code(500).send({ success: false, error: 'Fallo en la autenticación con Google' });
    }
  },
};
