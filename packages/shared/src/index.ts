/**
 * @transcendence/shared
 *
 * Contratos compartidos entre microservicios: tipos de eventos (RabbitMQ),
 * DTOs de API y utilidades comunes. Mantener este paquete como única fuente
 * de verdad para que los servicios no se desincronicen.
 *
 * A medida que avance el plan (ver docs/01-IMPLEMENTATION_PLAN.md) aquí irán:
 *   - auth.ts      → verificación de JWT y hook requireAuth (C1.4)
 *   - vault.ts     → cliente de secretos (C1.1)
 *   - events.ts    → contratos de eventos RabbitMQ (C2.1)
 */

export const SHARED_VERSION = '0.1.0';

// Contratos del lobby multijugador y mensajes WSS (anfitrión/buscar partida).
export * from './lobby.js';
export * from './ws.js';

// Contratos de dominio (tablero, pokémon) y de estado de partida.
// ÚNICA fuente de verdad; backend y frontend re-exportan desde aquí.
export * from './domain.js';
export * from './match.js';
export * from './combat.js';

/** Estado de presencia de un usuario (status-service). */
export type PresenceStatus = 'online' | 'offline' | 'in-game';

/** Vista pública de un usuario (COMUNIDAD): nunca expone email ni datos sensibles. */
export interface PublicUser {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  /** Presencia (derivada de sockets abiertos). Solo se rellena en algunas rutas. */
  online?: boolean;
}

/** Respuesta estándar de healthcheck para todos los servicios. */
export interface HealthResponse {
  status: 'ok';
  service: string;
  uptime: number;
}
