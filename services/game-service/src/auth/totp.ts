import { createHmac, randomBytes } from 'node:crypto';

/**
 * TOTP (RFC 6238) con node:crypto, sin dependencias externas. Andamiaje de 2FA:
 * genera un secreto base32 y verifica códigos de 6 dígitos con ventana ±1.
 *
 * El enrolado (mostrar QR/otpauth) y el flujo completo de UI quedan como trabajo
 * futuro; aquí está la base criptográfica y la verificación usada en el login.
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // segundos
const DIGITS = 6;

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  let bits = '';
  for (const ch of secret.toUpperCase().replace(/=+$/, '')) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** Verifica un código TOTP de 6 dígitos con ventana ±1 paso. `now` en ms (inyectable en tests). */
export function verifyTotp(secret: string, token: string, now: number): boolean {
  const clean = (token ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(now / 1000 / STEP);
  for (let w = -1; w <= 1; w++) {
    if (hotp(key, counter + w) === clean) return true;
  }
  return false;
}
