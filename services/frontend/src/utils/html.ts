/**
 * Escapado de datos dinámicos antes de inyectarlos en el DOM vía innerHTML.
 * ÚNICA implementación (antes había 4 divergentes; algunas NO escapaban las
 * comillas, permitiendo romper atributos). Ver docs/audit/SECURITY_AUDIT.md #5.
 */
const MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto y atributos (incluye comillas simples y dobles). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]!);
}

/** Alias semántico para valores que van dentro de un atributo entre comillas. */
export const escapeAttr = escapeHtml;
