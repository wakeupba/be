/*
 * Structured logging for the paths that matter. Workers Logs indexes the
 * fields of objects passed to console.*, so critical events log a flat
 * object with a stable `event` name (dot-namespaced: 'call.place_failed')
 * and become filterable in the dashboard instead of grep-able prose.
 */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  console[level]({ event, ...fields });
}

/** errors serialize to '{}' in JSON.stringify; flatten to the useful bits */
export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { error: error.message, stack: error.stack };
  return { error: String(error) };
}
