/**
 * Progresión por nivel (Épica 6). Lógica PURA (sin BD ni red) → testeable.
 *
 * Dos usos:
 *  - `scaledVitals` (T6.2): stats de combate de una pieza según su nivel.
 *  - `xpForLevel`/`applyXp` (T6.1): curva de experiencia y subida de nivel.
 */

/** Nivel máximo alcanzable. */
export const LEVEL_CAP = 100;

/** Crecimiento de stats por nivel sobre la base (ajustable). 4%/nivel. */
const STAT_GROWTH = 0.04;

/** Nivel saneado al rango [1, LEVEL_CAP]. */
export function clampLevel(level: number): number {
  return Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
}

/**
 * Multiplicador de stats para un nivel: 1.0 a nivel 1 y creciente y lineal después
 * (`1 + (nivel-1)·STAT_GROWTH`). A nivel 1 no altera nada (compatibilidad con draft Lv.1).
 */
export function levelMultiplier(level: number): number {
  return 1 + (clampLevel(level) - 1) * STAT_GROWTH;
}

/** Escala una stat base por el nivel (redondeada). */
export function scaleStat(base: number, level: number): number {
  return Math.round(base * levelMultiplier(level));
}

/**
 * Vitales de combate de una pieza a un nivel dado (hp a tope). La base de vida es `maxHp`
 * de la plantilla (nace con la vida llena).
 */
export function scaledVitals(
  base: { maxHp: number; atk: number; def: number },
  level: number
): { hp: number; maxHp: number; atk: number; def: number } {
  const maxHp = scaleStat(base.maxHp, level);
  return {
    hp: maxHp,
    maxHp,
    atk: scaleStat(base.atk, level),
    def: scaleStat(base.def, level),
  };
}
