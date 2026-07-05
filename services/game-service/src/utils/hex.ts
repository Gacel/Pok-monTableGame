import type { Hex } from '@transcendence/shared';

/** Type guard: valida que un input del cliente sea una coordenada hex entera. */
export function isHex(h: unknown): h is Hex {
  return (
    typeof h === 'object' &&
    h !== null &&
    Number.isInteger((h as Hex).q) &&
    Number.isInteger((h as Hex).r)
  );
}
