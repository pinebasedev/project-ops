// Structured logging for the control-plane Worker.
//
// Cloudflare Workers Logs (enabled via `observability` in alchemy.run.ts)
// ingests every `console.log`/`console.error` call. When the argument is a
// plain object it extracts and indexes each field, so lines can be filtered by
// `status`, `requestId`, `level`, … in the dashboard; a bare string is only
// full-text searchable. See
// https://developers.cloudflare.com/workers/observability/logs/workers-logs/#best-practices
//
// So every line this module emits is a single JSON object with a stable shape:
//
//   { level, message, time, requestId?, ...fields }
//
// `warn`/`error` go through `console.error` so they also land in the
// stderr-backed stream the errors route queries (helpers/observability.ts);
// `debug`/`info` go through `console.log`. Keep each line well under the
// 256 KB per-log limit — don't dump request bodies or full DB rows.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Derive a logger that merges `fields` into every line it emits. */
  with(fields: LogFields): Logger;
}

/** Flatten an `Error` (or anything thrown) into indexable fields. */
export function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause !== undefined ? { cause: serializeError(err.cause) } : {}),
    };
  }
  return { value: String(err) };
}

// Replace any top-level `Error` value with its serialized form — `Error`
// doesn't survive the structured-clone/JSON step Workers Logs applies.
function normalizeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

/**
 * Build a logger. `bound` fields (typically `{ requestId }`) are merged into
 * every line; call {@link Logger.with} to add more for a sub-scope.
 */
export function createLogger(bound: LogFields = {}): Logger {
  function emit(level: LogLevel, message: string, fields?: LogFields): void {
    const line = {
      level,
      message,
      time: new Date().toISOString(),
      ...bound,
      ...(fields ? normalizeFields(fields) : {}),
    };
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
  }

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    with: (fields) => createLogger({ ...bound, ...normalizeFields(fields) }),
  };
}
