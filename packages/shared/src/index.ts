/**
 * @transcendence/shared
 *
 * Contratos compartidos entre microservicios: tipos de eventos (RabbitMQ),
 * DTOs de API y utilidades comunes. Mantener este paquete como única fuente
 * de verdad para que los servicios no se desincronicen.
 *
 * A medida que avance el plan (ver docs/IMPLEMENTATION_PLAN.md) aquí irán:
 *   - auth.ts      → verificación de JWT y hook requireAuth (C1.4)
 *   - vault.ts     → cliente de secretos (C1.1)
 *   - events.ts    → contratos de eventos RabbitMQ (C2.1)
 */

export const SHARED_VERSION = '0.1.0';

/** Biomas del tablero (lógica Catan). */
export const BIOMES = ['fire', 'water', 'forest'] as const;
export type Biome = (typeof BIOMES)[number];

/** Patrones de movimiento (lógica Ajedrez). */
export const MOVEMENT_PATTERNS = ['flyer', 'tank', 'speedster'] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Estado de presencia de un usuario (status-service). */
export type PresenceStatus = 'online' | 'offline' | 'in-game';

/** Respuesta estándar de healthcheck para todos los servicios. */
export interface HealthResponse {
  status: 'ok';
  service: string;
  uptime: number;
}
